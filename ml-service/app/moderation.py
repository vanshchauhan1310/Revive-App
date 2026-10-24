"""Trust & safety classifiers (HF hosted models)."""
from __future__ import annotations

from .hf import HFClient

# unitary/toxic-bert labels; all are treated as "unsafe" signals.
TOXIC_LABELS = {"toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"}
NSFW_LABELS = {"nsfw", "porn", "hentai", "sexy"}


def moderate_text(hf: HFClient, model: str, texts: list[str]) -> list[dict]:
    results = []
    for text in texts:
        scores = hf.classify_text(text, model)
        unsafe = [(label, s) for label, s in scores if label.lower() in TOXIC_LABELS]
        label, score = max(unsafe, key=lambda x: x[1]) if unsafe else ("ok", 0.0)
        results.append({"label": label.lower(), "score": round(score, 4), "scores": {l.lower(): round(s, 4) for l, s in scores}})
    return results


def moderate_images(hf: HFClient, model: str, urls: list[str]) -> list[dict]:
    results = []
    for url in urls:
        scores = hf.classify_image(url, model)
        unsafe = [s for label, s in scores if label.lower() in NSFW_LABELS]
        results.append({"url": url, "label": "nsfw" if unsafe and max(unsafe) >= 0.5 else "ok",
                        "score": round(max(unsafe) if unsafe else 0.0, 4)})
    return results
