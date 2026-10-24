"""Batch job: refresh profiles.reliability_score with the production risk model.

Reliability is only ever shown as a badge to listing owners; it never blocks anyone.

    python -m pipelines.score_users [--dry-run]
"""
from __future__ import annotations

import argparse

import pandas as pd

from app.config import get_settings
from app.ranking import RiskModel

from .common import db_connect

CURRENT_FEATURES_SQL = """
select p.id::text as user_id,
       extract(epoch from now() - p.created_at) / 86400.0 as requester_age_days,
       (select count(*) from orders o where o.requester_id = p.id and o.status = 'completed') as prior_completed,
       (select count(*) from orders o where o.requester_id = p.id and
          ((o.status = 'cancelled' and (o.cancelled_by = o.requester_id or o.cancel_reason = 'no_show'))
           or (o.status = 'expired' and o.accepted_at is not null))) as prior_failed,
       (select count(*) from reports r where r.target_type = 'user' and r.target_id = p.id::text) as prior_reports,
       12 as request_hour
from profiles p
where p.deleted_at is null
  and exists (select 1 from orders o where o.requester_id = p.id)
"""


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    model = RiskModel(get_settings().model_dir)
    with db_connect() as conn:
        df = pd.read_sql(CURRENT_FEATURES_SQL, conn)
        if df.empty:
            print("no users with exchange history")
            return
        scores, meta = model.score(df.to_dict("records"))
        df["score"] = [round(s, 3) for s in scores]
        print(f"scored {len(df)} users with {meta['model']}@{meta['model_version']}; mean={df['score'].mean():.3f}")
        if args.dry_run:
            print(df[["user_id", "prior_completed", "prior_failed", "score"]].head(20).to_string(index=False))
            return
        with conn.cursor() as cur:
            cur.executemany("update profiles set reliability_score = %s where id = %s::uuid",
                            list(zip(df["score"], df["user_id"])))
        conn.commit()


if __name__ == "__main__":
    main()
