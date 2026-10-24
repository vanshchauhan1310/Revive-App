"""Feature definitions shared by serving (app/) and training (pipelines/).

Keeping one definition prevents training/serving skew: the backend logs the exact
candidate features at impression time and the trainer reads them back through here.
"""
from __future__ import annotations

import math
from typing import Iterable, Mapping

import numpy as np

RANKER_FEATURES = [
    "similarity", "similarity_missing", "log_distance_km", "distance_missing", "log_age_hours",
    "hours_to_expiry_clipped", "expiry_missing", "log_popularity", "owner_reliability",
    "is_food", "is_free", "log_price", "has_image",
]

RISK_FEATURES = [
    "log_requester_age_days", "prior_completed", "prior_failed", "prior_fail_rate", "prior_reports",
    "log_distance_km", "distance_missing", "is_food", "is_free", "log_price", "night_request",
]


def _num(v, default=None):
    try:
        if v is None:
            return default
        f = float(v)
        return default if math.isnan(f) else f
    except (TypeError, ValueError):
        return default


def ranker_row(c: Mapping) -> list[float]:
    sim = _num(c.get("similarity"))
    dist = _num(c.get("distance_km"))
    exp = _num(c.get("hours_to_expiry"))
    rel = _num(c.get("owner_reliability"), 0.7)
    return [
        sim if sim is not None else 0.0,
        1.0 if sim is None else 0.0,
        math.log1p(dist) if dist is not None else 0.0,
        1.0 if dist is None else 0.0,
        math.log1p(max(_num(c.get("age_hours"), 0.0), 0.0)),
        min(max(exp, 0.0), 168.0) / 168.0 if exp is not None else 1.0,
        1.0 if exp is None else 0.0,
        math.log1p(max(_num(c.get("popularity"), 0.0), 0.0)),
        rel,
        1.0 if c.get("kind") == "food" else 0.0,
        1.0 if c.get("exchange_mode", "free") == "free" else 0.0,
        math.log1p(max(_num(c.get("price_credits"), 0.0), 0.0)),
        1.0 if c.get("has_image") else 0.0,
    ]


def risk_row(r: Mapping) -> list[float]:
    completed = _num(r.get("prior_completed"), 0.0)
    failed = _num(r.get("prior_failed"), 0.0)
    dist = _num(r.get("distance_km"))
    hour = int(_num(r.get("request_hour"), 12))
    return [
        math.log1p(max(_num(r.get("requester_age_days"), 0.0), 0.0)),
        completed,
        failed,
        failed / (completed + failed + 1.0),
        _num(r.get("prior_reports"), 0.0),
        math.log1p(dist) if dist is not None else 0.0,
        1.0 if dist is None else 0.0,
        1.0 if r.get("kind") == "food" else 0.0,
        1.0 if r.get("exchange_mode", "free") == "free" else 0.0,
        math.log1p(max(_num(r.get("price_credits"), 0.0), 0.0)),
        1.0 if hour >= 22 or hour < 6 else 0.0,
    ]


def ranker_matrix(rows: Iterable[Mapping]) -> np.ndarray:
    return np.asarray([ranker_row(r) for r in rows], dtype=np.float32).reshape(-1, len(RANKER_FEATURES))


def risk_matrix(rows: Iterable[Mapping]) -> np.ndarray:
    return np.asarray([risk_row(r) for r in rows], dtype=np.float32).reshape(-1, len(RISK_FEATURES))
