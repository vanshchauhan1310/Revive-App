"""Free, local inference with open Hugging Face models (no Inference Providers credits).

Weights download once from the Hugging Face Hub into the HF cache, then run on this
machine (Apple GPU via MPS when available, otherwise CPU). Every model loads lazily on
first use, so services that never caption images never pay for the captioner.

    python -m app.local_models --download    # pre-fetch all weights (~2.5 GB)
"""
from __future__ import annotations

import base64
import io
import threading
from typing import Any

import httpx
import numpy as np

MAX_IMAGE_BYTES = 8 * 1024 * 1024


class LocalModels:
    def __init__(self, settings):
        import torch  # imported lazily so the API image can run without torch

        self.torch = torch
        self.settings = settings
        self.device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
        self._cache: dict[str, Any] = {}
        self._lock = threading.Lock()

    # ---- loading ---------------------------------------------------------------
    def _get(self, key: str, loader):
        if key not in self._cache:
            with self._lock:
                if key not in self._cache:
                    self._cache[key] = loader()
        return self._cache[key]

    def _clip(self):
        from transformers import CLIPModel, CLIPProcessor

        name = self.settings.clip_model
        return self._get("clip", lambda: (CLIPModel.from_pretrained(name).to(self.device).eval(), CLIPProcessor.from_pretrained(name)))

    def _blip(self):
        from transformers import BlipForConditionalGeneration, BlipProcessor

        name = self.settings.local_caption_model
        return self._get("blip", lambda: (BlipForConditionalGeneration.from_pretrained(name).to(self.device).eval(), BlipProcessor.from_pretrained(name)))

    def _text_classifier(self, name: str):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        return self._get(f"tc:{name}", lambda: (AutoModelForSequenceClassification.from_pretrained(name).to(self.device).eval(), AutoTokenizer.from_pretrained(name)))

    def _image_classifier(self, name: str):
        from transformers import AutoImageProcessor, AutoModelForImageClassification

        return self._get(f"ic:{name}", lambda: (AutoModelForImageClassification.from_pretrained(name).to(self.device).eval(), AutoImageProcessor.from_pretrained(name)))

    def _embedder(self):
        from transformers import AutoModel, AutoTokenizer

        name = self.settings.embedding_model
        return self._get("emb", lambda: (AutoModel.from_pretrained(name).to(self.device).eval(), AutoTokenizer.from_pretrained(name)))

    # ---- inputs ----------------------------------------------------------------
    @staticmethod
    def load_image(url: str):
        from PIL import Image

        if url.startswith("data:"):
            data = base64.b64decode(url.split(",", 1)[1])
        else:
            with httpx.Client(timeout=15, follow_redirects=True) as c:
                r = c.get(url)
                r.raise_for_status()
                data = r.content
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("image too large")
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail((768, 768))
        return img

    # ---- tasks -----------------------------------------------------------------
    def caption(self, image) -> str:
        model, proc = self._blip()
        with self.torch.inference_mode():
            inputs = proc(images=image, text="a photo of", return_tensors="pt").to(self.device)
            out = model.generate(**inputs, max_new_tokens=30, num_beams=3, repetition_penalty=1.4, no_repeat_ngram_size=2)
        return proc.decode(out[0], skip_special_tokens=True).strip()

    def zero_shot_image(self, image, prompts: list[str]) -> list[float]:
        model, proc = self._clip()
        with self.torch.inference_mode():
            inputs = proc(text=prompts, images=image, return_tensors="pt", padding=True).to(self.device)
            probs = model(**inputs).logits_per_image.softmax(dim=-1)[0]
        return [float(p) for p in probs.cpu()]

    def classify_text(self, text: str, model_name: str) -> list[tuple[str, float]]:
        model, tok = self._text_classifier(model_name)
        with self.torch.inference_mode():
            inputs = tok(text[:2000], return_tensors="pt", truncation=True, max_length=256).to(self.device)
            logits = model(**inputs).logits[0]
        # toxic-bert is multi-label: independent sigmoid per label
        scores = self.torch.sigmoid(logits).cpu().tolist()
        labels = model.config.id2label
        return sorted(((labels[i], float(s)) for i, s in enumerate(scores)), key=lambda x: -x[1])

    def classify_image(self, image, model_name: str) -> list[tuple[str, float]]:
        model, proc = self._image_classifier(model_name)
        with self.torch.inference_mode():
            inputs = proc(images=image, return_tensors="pt").to(self.device)
            probs = model(**inputs).logits.softmax(dim=-1)[0].cpu().tolist()
        labels = model.config.id2label
        return sorted(((labels[i], float(p)) for i, p in enumerate(probs)), key=lambda x: -x[1])

    def embed(self, texts: list[str]) -> np.ndarray:
        model, tok = self._embedder()
        with self.torch.inference_mode():
            batch = tok(texts, return_tensors="pt", padding=True, truncation=True, max_length=256).to(self.device)
            hidden = model(**batch).last_hidden_state
            mask = batch["attention_mask"].unsqueeze(-1).float()
            pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
        return pooled.cpu().numpy().astype(np.float32)


def try_create(settings) -> LocalModels | None:
    """Local backend if torch + transformers are installed (requirements-local.txt), else None."""
    if settings.hf_mode == "api":
        return None
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError:
        return None
    return LocalModels(settings)


if __name__ == "__main__":
    import argparse

    from .config import get_settings

    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="download every local model's weights now")
    args = ap.parse_args()
    s = get_settings()
    lm = LocalModels(s)
    if args.download:
        for step, fn in [("CLIP", lm._clip), ("BLIP captioner", lm._blip), ("toxicity", lambda: lm._text_classifier(s.toxicity_model)),
                         ("NSFW image", lambda: lm._image_classifier(s.nsfw_image_model)), ("embeddings", lm._embedder)]:
            print(f"loading {step}…", flush=True)
            fn()
        print(f"all local models ready on {lm.device}")
