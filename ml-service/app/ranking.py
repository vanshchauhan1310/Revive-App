"""Ranking for the "For you" feed: trained model when promoted, heuristic otherwise."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Mapping

import joblib

from .features import RANKER_FEATURES, RISK_FEATURES, ranker_matrix, risk_matrix


def heuristic_score(c: Mapping) -> float:
    """Cold-start scorer. Mirrors backend/src/services/ranking.js::heuristicScore."""
    age = float(c.get("age_hours") or 0)
    dist = c.get("distance_km")
    sim = c.get("similarity")
    exp = c.get("hours_to_expiry")
    freshness = math.exp(-age / 48)
    distance = 0.5 if dist is None else 1 / (1 + float(dist) / 2)
    popularity = min(math.log1p(float(c.get("popularity") or 0)) / math.log(20), 1)
    similarity = 0.5 if sim is None else float(sim)
    urgency = 0 if exp is None else 0.3 if exp < 6 else 0.15 if exp < 24 else 0
    free = 0.1 if c.get("exchange_mode") == "free" else 0
    image = 0.1 if c.get("has_image") else 0
    return 0.35 * similarity + 0.25 * distance + 0.2 * freshness + 0.1 * popularity + urgency + free + image


class ProductionModel:
    """A model exported by pipelines/evaluate.py: <dir>/<name>.joblib + <name>.json manifest."""

    def __init__(self, model_dir: Path, name: str, features: list[str]):
        self.model_dir, self.name, self.features = Path(model_dir), name, features
        self.model = None
        self.manifest: dict = {}
        self.reload()

    def reload(self) -> bool:
        path, manifest = self.model_dir / f"{self.name}.joblib", self.model_dir / f"{self.name}.json"
        if not path.exists() or not manifest.exists():
            self.model, self.manifest = None, {}
            return False
        meta = json.loads(manifest.read_text())
        if meta.get("features") != self.features:
            # Refuse a model trained on a different feature contract.
            self.model, self.manifest = None, {}
            return False
        self.model, self.manifest = joblib.load(path), meta
        return True

    @property
    def version(self) -> str | None:
        return str(self.manifest.get("version")) if self.manifest else None

    def predict_proba(self, X):
        return self.model.predict_proba(X)[:, 1]


class Ranker(ProductionModel):
    def __init__(self, model_dir: Path):
        super().__init__(model_dir, "ranker", RANKER_FEATURES)

    def score(self, candidates: list[Mapping]) -> tuple[list[float], dict]:
        if self.model is None or not candidates:
            return [heuristic_score(c) for c in candidates], {"model": "heuristic", "model_version": None, "fallback": True}
        probs = self.predict_proba(ranker_matrix(candidates))
        return [float(p) for p in probs], {"model": "ecoshare-ranker", "model_version": self.version, "fallback": False}


class RiskModel(ProductionModel):
    """P(requester completes the exchange). Reliability = calibrated completion probability."""

    def __init__(self, model_dir: Path):
        super().__init__(model_dir, "risk", RISK_FEATURES)

    def score(self, rows: list[Mapping]) -> tuple[list[float], dict]:
        if self.model is None or not rows:
            # Beta(4,1)-style prior updated by the user's own history.
            out = []
            for r in rows:
                done, failed = float(r.get("prior_completed") or 0), float(r.get("prior_failed") or 0)
                out.append((done + 4) / (done + failed + 5))
            return out, {"model": "prior", "model_version": None, "fallback": True}
        probs = self.predict_proba(risk_matrix(rows))
        return [float(p) for p in probs], {"model": "ecoshare-risk", "model_version": self.version, "fallback": False}
