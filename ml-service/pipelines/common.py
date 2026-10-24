"""Shared helpers for the MLOps pipelines: data access, synthetic data, metrics, MLflow."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FEATURES_DIR = DATA / "features"
REPORTS = ROOT / "reports"
MODEL_DIR = ROOT / "models" / "production"
os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")

RANKER_NAME = "ecoshare-ranker"
RISK_NAME = "ecoshare-risk"


def mlflow_setup(experiment: str):
    import mlflow

    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", f"sqlite:///{ROOT / 'mlflow.db'}"))
    mlflow.set_experiment(experiment)
    return mlflow


def db_connect():
    import psycopg

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set (Supabase -> Project settings -> Database -> connection string). "
                         "Use --synthetic to run without a database.")
    return psycopg.connect(url)


def frame_hash(df: pd.DataFrame) -> str:
    return hashlib.sha256(pd.util.hash_pandas_object(df, index=False).values.tobytes()).hexdigest()[:16]


def latest_snapshot(kind: str) -> Path | None:
    files = sorted(FEATURES_DIR.glob(f"{kind}-*.parquet"))
    return files[-1] if files else None


# ---------------------------------------------------------------------------
# Extraction from Supabase Postgres
# ---------------------------------------------------------------------------
RANKER_SQL = """
select i.id, i.user_id::text, i.listing_id::text, i.created_at, i.context,
       exists (select 1 from public.interactions e
                where e.user_id = i.user_id and e.listing_id = i.listing_id
                  and e.event in ('view', 'save', 'request', 'chat', 'complete')
                  and e.created_at between i.created_at and i.created_at + interval '7 days') as engaged
from public.interactions i
where i.event = 'impression' and i.context ? 'f' and i.user_id is not null
  and i.created_at > now() - interval '180 days'
"""

RISK_SQL = "select * from public.ml_order_outcomes where created_at > now() - interval '365 days'"


def load_ranker_from_db() -> pd.DataFrame:
    with db_connect() as conn:
        raw = pd.read_sql(RANKER_SQL, conn)
    if raw.empty:
        return raw
    feats = pd.json_normalize(raw["context"].map(lambda c: c.get("f", {})))
    df = pd.concat([raw.drop(columns=["context"]), feats], axis=1)
    df["session"] = df["user_id"] + "|" + pd.to_datetime(df["created_at"]).dt.floor("h").astype(str)
    df["label"] = df.pop("engaged").astype(int)
    return df


def load_risk_from_db() -> pd.DataFrame:
    with db_connect() as conn:
        df = pd.read_sql(RISK_SQL, conn)
    df["label"] = df.pop("completed").astype(int)
    return df


# ---------------------------------------------------------------------------
# Synthetic data (deterministic) so the full pipeline runs before real traffic exists
# ---------------------------------------------------------------------------
def _sigmoid(x):
    return 1 / (1 + np.exp(-x))


def synthetic_ranker(n_users: int = 300, sessions_per_user: int = 6, per_session: int = 20,
                     seed: int = 7, shift: float = 0.0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    start = datetime(2026, 6, 1, tzinfo=timezone.utc)
    rows = []
    for u in range(n_users):
        for s in range(sessions_per_user):
            ts = start + timedelta(hours=int(rng.integers(0, 24 * 120)))
            for k in range(per_session):
                sim = float(np.clip(rng.normal(0.45 + shift, 0.2), -0.2, 1)) if rng.random() > 0.15 else None
                dist = float(rng.gamma(2, 2.0 + 3 * shift)) if rng.random() > 0.1 else None
                age = float(rng.exponential(40 + 40 * shift))
                exp = float(rng.exponential(30)) if rng.random() > 0.5 else None
                pop = int(rng.poisson(2))
                free = rng.random() < 0.6
                img = rng.random() < 0.8
                kind = "food" if rng.random() < 0.5 else "non_food"
                logit = (-2.2 + 3.0 * (sim if sim is not None else 0.4) - 0.5 * np.log1p(dist if dist is not None else 5)
                         - 0.35 * np.log1p(age) + 0.7 * free + 0.6 * img + 0.35 * np.log1p(pop)
                         + (0.5 if exp is not None and exp < 12 and kind == "food" else 0) + rng.normal(0, 0.4))
                rows.append({
                    "user_id": f"u{u}", "listing_id": f"l{u}-{s}-{k}", "created_at": ts,
                    "session": f"u{u}|{s}", "similarity": sim, "distance_km": dist, "age_hours": age,
                    "hours_to_expiry": exp, "popularity": pop, "owner_reliability": float(rng.uniform(0.5, 1)),
                    "kind": kind, "exchange_mode": "free" if free else "credits",
                    "price_credits": 0 if free else int(rng.integers(5, 80)), "has_image": img,
                    "label": int(rng.random() < _sigmoid(logit)),
                })
    return pd.DataFrame(rows)


def synthetic_risk(n: int = 4000, seed: int = 11) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = []
    for i in range(n):
        age = float(rng.exponential(60))
        done = int(rng.poisson(3))
        failed = int(rng.poisson(0.6))
        reports = int(rng.random() < 0.05)
        dist = float(rng.gamma(2, 2.5)) if rng.random() > 0.1 else None
        hour = int(rng.integers(0, 24))
        kind = "food" if rng.random() < 0.5 else "non_food"
        free = rng.random() < 0.6
        logit = (1.6 + 0.35 * np.log1p(age) + 0.25 * done - 0.9 * failed - 1.5 * reports
                 - 0.15 * (dist or 5) - (0.6 if hour >= 22 or hour < 6 else 0) + rng.normal(0, 0.5))
        rows.append({
            "order_id": f"o{i}", "created_at": start + timedelta(minutes=int(rng.integers(0, 60 * 24 * 280))),
            "requester_id": f"u{int(rng.integers(0, 800))}", "kind": kind, "exchange_mode": "free" if free else "credits",
            "price_credits": 0 if free else int(rng.integers(5, 80)), "request_hour": hour, "requester_age_days": age,
            "distance_km": dist, "prior_completed": done, "prior_failed": failed, "prior_reports": reports,
            "label": int(rng.random() < _sigmoid(logit)),
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Splits & metrics
# ---------------------------------------------------------------------------
def time_split(df: pd.DataFrame, group: str | None = None, holdout: float = 0.2):
    """Out-of-time split; when grouping, whole groups go to one side."""
    df = df.sort_values("created_at").reset_index(drop=True)
    if group:
        order = df.groupby(group)["created_at"].min().sort_values()
        cut = set(order.index[int(len(order) * (1 - holdout)):])
        test = df[group].isin(cut)
        return df[~test].reset_index(drop=True), df[test].reset_index(drop=True)
    k = int(len(df) * (1 - holdout))
    return df.iloc[:k].reset_index(drop=True), df.iloc[k:].reset_index(drop=True)


def ndcg_at_k(df: pd.DataFrame, score_col: str, k: int = 10, group: str = "session") -> float:
    vals = []
    for _, g in df.groupby(group):
        if g["label"].sum() == 0:
            continue
        ranked = g.sort_values(score_col, ascending=False)["label"].to_numpy()[:k]
        ideal = np.sort(g["label"].to_numpy())[::-1][:k]
        disc = 1 / np.log2(np.arange(2, k + 2))
        vals.append(float((ranked * disc[: len(ranked)]).sum() / (ideal * disc[: len(ideal)]).sum()))
    return float(np.mean(vals)) if vals else 0.0


def write_json(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str))
