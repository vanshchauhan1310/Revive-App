"""Extract training data from Supabase into versioned parquet snapshots.

    python -m pipelines.build_features            # from DATABASE_URL
    python -m pipelines.build_features --synthetic
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

from .common import FEATURES_DIR, frame_hash, load_ranker_from_db, load_risk_from_db, synthetic_ranker, synthetic_risk, write_json


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true")
    args = ap.parse_args(argv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    FEATURES_DIR.mkdir(parents=True, exist_ok=True)
    out = {}
    for kind, loader, synth in (("ranker", load_ranker_from_db, synthetic_ranker), ("risk", load_risk_from_db, synthetic_risk)):
        df = synth() if args.synthetic else loader()
        if df.empty:
            print(f"[{kind}] no rows yet; skipping")
            continue
        path = FEATURES_DIR / f"{kind}-{stamp}.parquet"
        df.to_parquet(path, index=False)
        out[kind] = {"path": str(path.name), "rows": len(df), "positives": int(df["label"].sum()), "hash": frame_hash(df),
                     "source": "synthetic" if args.synthetic else "supabase"}
        print(f"[{kind}] {len(df)} rows -> {path.name}")
    write_json(FEATURES_DIR / f"manifest-{stamp}.json", {"created_at": stamp, "snapshots": out})


if __name__ == "__main__":
    main()
