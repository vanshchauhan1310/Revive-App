"""EcoShare ml-service: the only component holding the Hugging Face token.

Every response carries `meta` (model, version, prompt version, latency, fallback) which the
backend persists to ml_predictions for auditing, evaluation and drift monitoring.
"""
from __future__ import annotations

import hmac
import time
from contextlib import contextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel, Field

from . import impact as impact_mod
from .config import Settings, get_settings
from .hf import HFClient, HFUnavailable
from .metrics import FALLBACKS, LATENCY, REQUESTS, SCORES
from .moderation import moderate_images, moderate_text
from .ranking import Ranker, RiskModel
from .suggest import suggest_listing


class Category(BaseModel):
    slug: str
    kind: Literal["food", "non_food"]
    label: str


class SuggestIn(BaseModel):
    image_url: str = Field(max_length=1000)
    kind_hint: Literal["food", "non_food"] | None = None
    notes: str | None = Field(default=None, max_length=300)
    categories: list[Category] = Field(min_length=1, max_length=100)


class TextsIn(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


class ImagesIn(BaseModel):
    image_urls: list[str] = Field(min_length=1, max_length=8)


class RankIn(BaseModel):
    user_id: str | None = None
    candidates: list[dict] = Field(max_length=500)


class RowsIn(BaseModel):
    rows: list[dict] = Field(max_length=1000)


class ImpactIn(BaseModel):
    items: list[dict] = Field(min_length=1, max_length=200)


def create_app(settings: Settings | None = None, hf: HFClient | None = None) -> FastAPI:
    settings = settings or get_settings()
    hf = hf or HFClient(settings)
    ranker = Ranker(settings.model_dir)
    if hf.local is not None and settings.local_warmup:
        # Load the local models in the background so the first user request is fast.
        import threading

        def warm():
            try:
                hf.local._clip(); hf.local._blip(); hf.local._text_classifier(settings.toxicity_model); hf.local._embedder()
            except Exception as err:  # never block startup on a download problem
                import logging
                logging.getLogger("ml").warning("local model warm-up failed: %s", err)
        threading.Thread(target=warm, daemon=True).start()
    risk = RiskModel(settings.model_dir)
    app = FastAPI(title="EcoShare ml-service", version="1.0.0")

    def require_token(authorization: str | None = Header(default=None)):
        if not settings.ml_service_token:
            return
        expected = f"Bearer {settings.ml_service_token}"
        if not authorization or not hmac.compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="invalid service token")

    @contextmanager
    def track(task: str):
        start = time.perf_counter()
        meta: dict = {}
        try:
            yield meta
            REQUESTS.labels(task, "ok").inc()
        except HFUnavailable as err:
            REQUESTS.labels(task, "unavailable").inc()
            raise HTTPException(status_code=503, detail=f"model unavailable: {err}") from err
        finally:
            meta["latency_ms"] = int((time.perf_counter() - start) * 1000)
            LATENCY.labels(task).observe(time.perf_counter() - start)
            if meta.get("fallback"):
                FALLBACKS.labels(task).inc()

    @app.get("/health")
    def health():
        return {"ok": True, "hf": hf.enabled, **{f"hf_{k}": v for k, v in hf.status().items()}, "ranker": ranker.version, "risk": risk.version}

    @app.get("/metrics")
    def metrics():
        return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    auth = [Depends(require_token)]

    @app.post("/v1/listing/suggest", dependencies=auth)
    def listing_suggest(body: SuggestIn):
        with track("listing_suggest") as meta:
            suggestion, info = suggest_listing(hf, settings, body.image_url, [c.model_dump() for c in body.categories],
                                               body.kind_hint, body.notes)
            meta.update(info)
        return {"suggestion": suggestion, "meta": meta}

    @app.post("/v1/moderate/text", dependencies=auth)
    def moderate_text_route(body: TextsIn):
        with track("moderate_text") as meta:
            results = moderate_text(hf, settings.toxicity_model, body.texts)
            meta.update(model=settings.toxicity_model, backend=hf.backend_used)
        for r in results:
            SCORES.labels("moderate_text").observe(r["score"])
        return {"results": results, "meta": meta}

    @app.post("/v1/moderate/image", dependencies=auth)
    def moderate_image_route(body: ImagesIn):
        with track("moderate_image") as meta:
            results = moderate_images(hf, settings.nsfw_image_model, body.image_urls)
            meta.update(model=settings.nsfw_image_model, backend=hf.backend_used)
        return {"results": results, "meta": meta}

    @app.post("/v1/embed", dependencies=auth)
    def embed(body: TextsIn):
        with track("embed") as meta:
            vecs = hf.embed(body.texts)
            if vecs.shape[1] != settings.embedding_dim:
                raise HTTPException(status_code=500, detail=f"embedding dim {vecs.shape[1]} != {settings.embedding_dim}")
            meta.update(model=settings.embedding_model, backend=hf.backend_used)
        return {"vectors": [[round(float(x), 6) for x in v] for v in vecs], "meta": meta}

    @app.post("/v1/rank", dependencies=auth)
    def rank(body: RankIn):
        with track("rank") as meta:
            scores, info = ranker.score(body.candidates)
            meta.update(info)
        for s in scores[:50]:
            SCORES.labels("rank").observe(min(max(s, 0.0), 1.0))
        ranked = sorted(({"listing_id": c["listing_id"], "score": s} for c, s in zip(body.candidates, scores)),
                        key=lambda x: x["score"], reverse=True)
        return {"scores": ranked, "meta": meta}

    @app.post("/v1/risk", dependencies=auth)
    def risk_route(body: RowsIn):
        with track("risk") as meta:
            scores, info = risk.score(body.rows)
            meta.update(info)
        return {"scores": scores, "meta": meta}

    @app.post("/v1/impact", dependencies=auth)
    def impact(body: ImpactIn):
        with track("impact") as meta:
            results = impact_mod.estimate(body.items, settings.impact_factors_version)
            meta.update(model="impact-factors", model_version=settings.impact_factors_version)
        return {"results": results, "meta": meta}

    @app.post("/admin/reload", dependencies=auth)
    def reload_models():
        return {"ranker": ranker.reload() and ranker.version, "risk": risk.reload() and risk.version}

    return app


app = create_app()
