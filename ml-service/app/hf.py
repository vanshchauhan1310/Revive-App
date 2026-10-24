"""Model access: hosted Hugging Face Inference Providers, with free local models as backup.

Each task tries the hosted API first (unless HF_MODE=local). If the API is unavailable,
for example 402 "no remaining credits" or a bad token, the hosted API is paused for an
hour and the same open models run locally through transformers. Callers see one interface
and can read `backend_used` to log which path served the request.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any, Callable

import numpy as np
from huggingface_hub import InferenceClient

from .config import Settings

log = logging.getLogger("ml.hf")
TRANSIENT = ("429", "503", "502", "504", "timed out", "Timeout", "loading", "overloaded")
ACCOUNT = ("402", "Payment Required", "credits", "401", "Unauthorized", "403", "Forbidden")
API_PAUSE_S = 3600


class HFUnavailable(RuntimeError):
    pass


class _LRU:
    def __init__(self, size: int = 2048):
        self.size = size
        self.data: OrderedDict[str, Any] = OrderedDict()

    def get(self, key: str):
        if key in self.data:
            self.data.move_to_end(key)
            return self.data[key]
        return None

    def put(self, key: str, value: Any):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.size:
            self.data.popitem(last=False)


class HFClient:
    def __init__(self, settings: Settings, client: Any | None = None, local: Any | None = "auto"):
        self.settings = settings
        self.api_configured = settings.hf_mode != "local" and (bool(settings.hf_api_token) or client is not None)
        self.client = client or InferenceClient(provider=settings.hf_provider, token=settings.hf_api_token, timeout=settings.hf_timeout_s)
        if local == "auto":
            from .local_models import try_create

            local = try_create(settings)
        self.local = local
        self.api_paused_until = 0.0
        self.backend_used = "none"
        self.cache = _LRU()

    @property
    def enabled(self) -> bool:
        return self.api_configured or self.local is not None

    def api_available(self) -> bool:
        return self.api_configured and time.time() >= self.api_paused_until

    def status(self) -> dict:
        return {"api": self.api_available(), "api_configured": self.api_configured, "local": self.local is not None,
                "local_device": getattr(self.local, "device", None)}

    # ---- routing --------------------------------------------------------------
    def _call_api(self, fn, *args, **kwargs):
        last: Exception | None = None
        for attempt in range(self.settings.hf_max_retries + 1):
            try:
                return fn(*args, **kwargs)
            except Exception as err:  # huggingface_hub raises several error types
                last = err
                if not any(t in str(err) for t in TRANSIENT) or attempt == self.settings.hf_max_retries:
                    break
                time.sleep(0.5 * 2 ** attempt)
        if last is not None and any(t in str(last) for t in ACCOUNT):
            self.api_paused_until = time.time() + API_PAUSE_S
            log.warning("Hosted HF API unavailable (%s); using local models for %ss", str(last).splitlines()[0][:120], API_PAUSE_S)
        raise HFUnavailable(str(last)) from last

    def _route(self, api: Callable[[], Any] | None, local: Callable[[Any], Any] | None):
        errors = []
        if api is not None and self.api_available():
            try:
                out = api()
                self.backend_used = "api"
                return out
            except Exception as err:  # HFUnavailable or a client-side error
                errors.append(f"api: {err}")
        if local is not None and self.local is not None:
            try:
                out = local(self.local)
                self.backend_used = "local"
                return out
            except Exception as err:  # model download / inference failure
                errors.append(f"local: {err}")
        raise HFUnavailable("; ".join(errors) or "no model backend configured (set HF_API_TOKEN or install requirements-local.txt)")

    @staticmethod
    def _key(*parts: Any) -> str:
        return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()

    # ---- tasks ----------------------------------------------------------------
    def chat_json(self, model: str, messages: list[dict], max_tokens: int = 600) -> str:
        """Vision-language chat: hosted only (too large to run locally)."""
        out = self._route(lambda: self._call_api(self.client.chat_completion, messages, model=model, max_tokens=max_tokens, temperature=0.2), None)
        return out.choices[0].message.content or ""

    def caption(self, image_url: str) -> str:
        def api():
            out = self._call_api(self.client.image_to_text, image_url, model=self.settings.caption_model)
            return getattr(out, "generated_text", None) or (out[0].generated_text if isinstance(out, list) else str(out))
        return self._route(api, lambda lm: lm.caption(lm.load_image(image_url)))

    def zero_shot(self, text: str, labels: list[str]) -> list[tuple[str, float]]:
        out = self._route(lambda: self._call_api(self.client.zero_shot_classification, text, labels, model=self.settings.zero_shot_model), None)
        return [(o.label, float(o.score)) for o in out]

    def zero_shot_image(self, image_url: str, prompts: list[str]) -> list[float]:
        """CLIP image-vs-text scores (local) — the free path for categorising photos."""
        def api():
            out = self._call_api(self.client.zero_shot_image_classification, image_url, candidate_labels=prompts, model=self.settings.clip_model)
            by = {o.label: float(o.score) for o in out}
            return [by.get(p, 0.0) for p in prompts]
        return self._route(api, lambda lm: lm.zero_shot_image(lm.load_image(image_url), prompts))

    def classify_text(self, text: str, model: str) -> list[tuple[str, float]]:
        key = self._key("text", model, text)
        if (hit := self.cache.get(key)) is not None:
            return hit
        def api():
            out = self._call_api(self.client.text_classification, text[:2000], model=model, top_k=10)
            return [(o.label, float(o.score)) for o in out]
        res = self._route(api, lambda lm: lm.classify_text(text, model))
        self.cache.put(key, res)
        return res

    def classify_image(self, image_url: str, model: str) -> list[tuple[str, float]]:
        key = self._key("image", model, image_url)
        if (hit := self.cache.get(key)) is not None:
            return hit
        def api():
            out = self._call_api(self.client.image_classification, image_url, model=model)
            return [(o.label, float(o.score)) for o in out]
        res = self._route(api, lambda lm: lm.classify_image(lm.load_image(image_url), model))
        self.cache.put(key, res)
        return res

    def embed(self, texts: list[str]) -> np.ndarray:
        model = self.settings.embedding_model
        missing = [t for t in texts if self.cache.get(self._key("emb", model, t)) is None]
        if missing:
            def api():
                arr = np.asarray(self._call_api(self.client.feature_extraction, missing, model=model), dtype=np.float32)
                if arr.ndim == 3:  # token embeddings -> mean pool
                    arr = arr.mean(axis=1)
                return arr[None, :] if arr.ndim == 1 else arr
            arr = self._route(api, lambda lm: lm.embed(missing))
            for t, v in zip(missing, arr):
                self.cache.put(self._key("emb", model, t), v)
        vecs = np.stack([self.cache.get(self._key("emb", model, t)) for t in texts])
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        return vecs / np.clip(norms, 1e-9, None)
