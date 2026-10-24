"""Model & prompt evaluation suite.

    python -m evals.run_evals            # offline (deterministic, no network) - runs in CI
    python -m evals.run_evals --live     # calls Hugging Face with HF_API_TOKEN

Writes reports/evals-<suite>.json and exits 1 if any gate in evals/thresholds.yaml fails.
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import sys
import time
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import get_settings  # noqa: E402
from app.impact import estimate  # noqa: E402
from app.suggest import extract_json, normalize  # noqa: E402

DATA = ROOT / "evals" / "data"
CATEGORIES = [
    {"slug": "baked_goods", "kind": "food", "label": "Baked goods"},
    {"slug": "cooked_meal", "kind": "food", "label": "Cooked meal"},
    {"slug": "produce", "kind": "food", "label": "Fruit & vegetables"},
    {"slug": "furniture", "kind": "non_food", "label": "Furniture"},
    {"slug": "books", "kind": "non_food", "label": "Books & stationery"},
    {"slug": "electronics", "kind": "non_food", "label": "Electronics"},
    {"slug": "clothing", "kind": "non_food", "label": "Clothing"},
    {"slug": "other", "kind": "non_food", "label": "Other"},
]


def load_jsonl(name: str) -> list[dict]:
    path = DATA / name
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()] if path.exists() else []


def offline() -> dict:
    cases = load_jsonl("suggest_replies.jsonl")
    passed = 0
    failures = []
    for case in cases:
        raw = extract_json(case["reply"])
        got = normalize(raw, CATEGORIES) if raw is not None else None
        exp = case["expect"]
        ok = got is None if exp is None else got is not None and all(got.get(k) == v for k, v in exp.items())
        passed += ok
        if not ok:
            failures.append({"case": case["name"], "got": got})

    settings = get_settings()
    impact = estimate([
        {"id": "a", "kind": "food", "category": "cooked_meal", "quantity_label": "4 portions"},
        {"id": "b", "kind": "non_food", "category": "furniture"},
        {"id": "c", "kind": "food", "category": "produce", "title": "2 kg tomatoes"},
    ], settings.impact_factors_version)
    by = {r["id"]: r for r in impact}
    sane = [
        abs(by["a"]["kg_waste"] - 1.4) < 1e-6,           # 4 portions x 0.35 kg
        by["b"]["kg_co2e"] > by["a"]["kg_co2e"],          # sofa-sized items outweigh a meal
        by["c"]["weight_method"] == "parsed_quantity" and by["c"]["kg_waste"] == 2.0,
    ]
    return {
        "suggest_parse_accuracy": passed / len(cases) if cases else 1.0,
        "impact_sanity": sum(sane) / len(sane),
        "failures": failures,
    }


def live() -> dict:
    from app.hf import HFClient, HFUnavailable
    from app.moderation import moderate_text
    from app.suggest import suggest_listing

    settings = get_settings()
    if not settings.hf_api_token:
        raise SystemExit("HF_API_TOKEN is required for --live")
    hf = HFClient(settings)
    latencies, correct = [], 0
    tox = load_jsonl("toxicity.jsonl")
    for case in tox:
        t = time.perf_counter()
        res = moderate_text(hf, settings.toxicity_model, [case["text"]])[0]
        latencies.append((time.perf_counter() - t) * 1000)
        correct += (res["score"] >= 0.8) == case["unsafe"]
    out = {"toxicity_accuracy": correct / len(tox)}

    photos = load_jsonl("listing_photos.jsonl")
    if photos:
        valid = right = 0
        for case in photos:
            url = case.get("url")
            if not url:
                p = DATA / case["path"]
                url = f"data:{mimetypes.guess_type(p.name)[0]};base64,{base64.b64encode(p.read_bytes()).decode()}"
            t = time.perf_counter()
            try:
                s, meta = suggest_listing(hf, settings, url, CATEGORIES)
                valid += not meta["fallback"]
                right += s["category"] == case["category"]
            except HFUnavailable:
                pass
            latencies.append((time.perf_counter() - t) * 1000)
        out.update(suggest_json_valid_rate=valid / len(photos), suggest_category_accuracy=right / len(photos))
    out["p95_latency_ms"] = float(np.percentile(latencies, 95)) if latencies else 0.0
    return out


def gate(results: dict, thresholds: dict) -> list[str]:
    fails = []
    for key, limit in thresholds.items():
        if key not in results:
            continue
        value = results[key]
        bad = value > limit if key.endswith("latency_ms") else value < limit
        if bad:
            fails.append(f"{key}={value:.3f} (limit {limit})")
    return fails


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    args = ap.parse_args(argv)
    suite = "live" if args.live else "offline"
    thresholds = yaml.safe_load((ROOT / "evals" / "thresholds.yaml").read_text())[suite]
    results = live() if args.live else offline()
    fails = gate(results, thresholds)
    report = {"suite": suite, "results": results, "failed_gates": fails,
              "prompt_version": get_settings().listing_prompt_version}
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "reports" / f"evals-{suite}.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
