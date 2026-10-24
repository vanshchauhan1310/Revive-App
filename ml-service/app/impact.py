"""Impact estimates for completed exchanges (kg CO2e avoided, kg waste diverted)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

WEIGHT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|kgs|g|grams?|l|litres?|liters?|ml)\b", re.I)
COUNT_RE = re.compile(r"(\d+)\s*(portions?|servings?|plates?|boxes?|pieces?|pcs|loaves|items?)\b", re.I)


@lru_cache
def load_factors(version: str) -> dict:
    return json.loads((Path(__file__).parent / f"{version}.json").read_text())


def estimate_weight_kg(item: dict, factors: dict) -> tuple[float, str]:
    if item.get("est_weight_kg"):
        return float(item["est_weight_kg"]), "listing_weight"
    text = " ".join(str(item.get(k) or "") for k in ("quantity_label", "title", "description"))
    if m := WEIGHT_RE.search(text):
        value, unit = float(m.group(1)), m.group(2).lower()
        kg = value / 1000 if unit in ("g", "gram", "grams", "ml") else value
        if 0 < kg < 500:
            return kg, "parsed_quantity"
    if item.get("kind") == "food" and (m := COUNT_RE.search(text)):
        return int(m.group(1)) * factors["portion_kg"], "portion_count"
    cat = factors["categories"].get(item.get("category") or "other", factors["categories"]["other"])
    return cat["default_kg"], "category_default"


def estimate(items: list[dict], version: str) -> list[dict]:
    factors = load_factors(version)
    out = []
    for item in items:
        cat = factors["categories"].get(item.get("category") or "other", factors["categories"]["other"])
        kg, method = estimate_weight_kg(item, factors)
        rate = 1.0 if item.get("kind") == "food" else factors["displacement_rate_non_food"]
        out.append({
            "id": item.get("id"),
            "kg_co2e": round(kg * cat["kg_co2e_per_kg"] * rate, 3),
            "kg_waste": round(kg, 3),
            "weight_method": method,
        })
    return out
