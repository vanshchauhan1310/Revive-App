"""Data/prediction drift monitor (Population Stability Index).

Compares the production ranker's training holdout (reference) with features logged at
serving time over the last N days. Exits 1 when any feature drifts past the alert
threshold, so a scheduled CI job turns red and prompts retraining.

    python -m pipelines.drift_report [--days 7] [--synthetic]
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.features import RANKER_FEATURES, ranker_matrix

from .common import MODEL_DIR, REPORTS, db_connect, synthetic_ranker, write_json

WARN, ALERT = 0.1, 0.25


def psi(reference: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
    reference, current = reference[~np.isnan(reference)], current[~np.isnan(current)]
    if len(reference) < 20 or len(current) < 20:
        return 0.0
    edges = np.unique(np.quantile(reference, np.linspace(0, 1, bins + 1)))
    if len(edges) < 3:  # (near-)constant feature: compare category shares instead
        ref_p = np.array([np.mean(reference == v) for v in np.unique(reference)])
        cur_p = np.array([np.mean(current == v) for v in np.unique(reference)])
    else:
        edges[0], edges[-1] = -np.inf, np.inf
        ref_p = np.histogram(reference, edges)[0] / len(reference)
        cur_p = np.histogram(current, edges)[0] / len(current)
    ref_p, cur_p = np.clip(ref_p, 1e-4, None), np.clip(cur_p, 1e-4, None)
    return float(np.sum((cur_p - ref_p) * np.log(cur_p / ref_p)))


def compare(ref_rows: list[dict], cur_rows: list[dict]) -> dict:
    ref, cur = ranker_matrix(ref_rows), ranker_matrix(cur_rows)
    features = {name: round(psi(ref[:, i], cur[:, i]), 4) for i, name in enumerate(RANKER_FEATURES)}
    worst = max(features.values()) if features else 0.0
    return {
        "features": features,
        "max_psi": worst,
        "status": "alert" if worst >= ALERT else "warn" if worst >= WARN else "ok",
        "reference_rows": len(ref_rows),
        "current_rows": len(cur_rows),
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--synthetic", action="store_true", help="simulate a shifted population")
    args = ap.parse_args(argv)

    if args.synthetic:
        reference = synthetic_ranker(n_users=80, seed=1).to_dict("records")
        current = synthetic_ranker(n_users=80, seed=2, shift=0.6).to_dict("records")
    else:
        manifest = MODEL_DIR / "ranker.json"
        if not manifest.exists():
            print("no production ranker; nothing to monitor")
            return 0
        import mlflow

        from .common import mlflow_setup

        mlflow_setup("ecoshare-ranker")
        run_id = json.loads(manifest.read_text())["run_id"]
        reference = pd.read_parquet(mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path="holdout.parquet")).to_dict("records")
        with db_connect() as conn:
            raw = pd.read_sql(
                "select context->'f' as f from interactions where event = 'impression' and context ? 'f' "
                "and created_at > now() - make_interval(days => %(d)s)", conn, params={"d": args.days})
        current = [r for r in raw["f"].tolist() if isinstance(r, dict)]

    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "window_days": args.days, **compare(reference, current)}
    path = REPORTS / f"drift-{datetime.now(timezone.utc):%Y%m%d}.json"
    write_json(path, report)
    print(json.dumps({k: report[k] for k in ("status", "max_psi", "current_rows")}), "->", path)
    return 1 if report["status"] == "alert" else 0


if __name__ == "__main__":
    raise SystemExit(main())
