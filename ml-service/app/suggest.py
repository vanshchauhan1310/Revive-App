"""Smart listing: photo -> draft listing fields (vision-language model on HF)."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import yaml

from .hf import HFClient, HFUnavailable

PROMPTS = Path(__file__).parent / "prompts"
ALLERGENS = {"gluten", "dairy", "egg", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame"}
DIETARY = {"vegetarian", "vegan", "halal", "jain", "gluten_free", "contains_meat"}


@lru_cache
def load_prompt(version: str) -> dict:
    return yaml.safe_load((PROMPTS / f"{version}.yaml").read_text())


def extract_json(text: str) -> dict | None:
    """Parse the first JSON object in a model reply (tolerates code fences / chatter)."""
    if not text:
        return None
    text = re.sub(r"```(?:json)?", "", text)
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start : i + 1])
                        return obj if isinstance(obj, dict) else None
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None


def normalize(raw: dict, categories: list[dict]) -> dict:
    slugs = {c["slug"]: c for c in categories}
    cat = slugs.get(str(raw.get("category", "")).strip())
    kind = cat["kind"] if cat else raw.get("kind") if raw.get("kind") in ("food", "non_food") else None
    as_list = lambda v, allowed: [x for x in (v or []) if isinstance(x, str) and x in allowed]  # noqa: E731
    num = lambda v: float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None  # noqa: E731
    return {
        "title": str(raw.get("title") or "")[:80],
        "description": str(raw.get("description") or "")[:2000],
        "kind": kind,
        "category": cat["slug"] if cat else None,
        "condition": raw.get("condition") if kind == "non_food" and raw.get("condition") in ("new", "like_new", "good", "fair") else None,
        "allergens": as_list(raw.get("allergens"), ALLERGENS) if kind == "food" else [],
        "dietary_tags": as_list(raw.get("dietary_tags"), DIETARY) if kind == "food" else [],
        "storage_info": (str(raw["storage_info"])[:200] if raw.get("storage_info") else None) if kind == "food" else None,
        "shelf_life_hours": num(raw.get("shelf_life_hours")) if kind == "food" else None,
        "est_weight_kg": num(raw.get("est_weight_kg")),
        "safety_notes": [str(s)[:120] for s in (raw.get("safety_notes") or []) if isinstance(s, str)][:5],
        "confidence": num(raw.get("confidence")),
    }


def build_messages(prompt: dict, image_url: str, categories: list[dict], kind_hint: str | None, notes: str | None):
    cat_lines = "\n".join(f"- {c['slug']}: {c['label']} ({c['kind']})" for c in categories)
    hint = []
    if kind_hint:
        hint.append(f"The owner says this is {'food' if kind_hint == 'food' else 'not food'}.")
    if notes:
        hint.append(f"Owner notes: {notes[:300]}")
    user_text = prompt["user"].format(categories=cat_lines, hint="\n".join(hint))
    return [
        {"role": "system", "content": prompt["system"]},
        {"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": image_url}},
            {"type": "text", "text": user_text},
        ]},
    ]


# ---------------------------------------------------------------------------
# Free path: CLIP (category from the photo) + BLIP (caption) run locally.
# ---------------------------------------------------------------------------
CATEGORY_PROMPTS = {
    "cooked_meal": "a plate or container of cooked food, a prepared meal",
    "baked_goods": "bread, pastries, cake or other baked goods",
    "produce": "fresh fruit or vegetables",
    "dairy": "dairy products such as milk, cheese, yogurt or eggs",
    "packaged_food": "packaged food in a box, bag, can or jar",
    "beverages": "a drink, juice or beverage bottle",
    "clothing": "clothing such as a jacket, shirt, dress or shoes",
    "books": "books, notebooks or stationery",
    "electronics": "an electronic device such as headphones, a phone, laptop or camera",
    "furniture": "furniture such as a chair, table, desk, lamp or sofa",
    "kitchenware": "kitchenware such as pots, pans, plates, cups or mugs",
    "toys": "a children's toy, teddy bear or building blocks",
    "sports": "sports or outdoor equipment such as a bicycle, ball or yoga mat",
    "other": "a miscellaneous household object",
}
ALLERGEN_WORDS = {
    "gluten": ("bread", "loaf", "cake", "pastry", "pastries", "croissant", "pizza", "pasta", "cookie", "biscuit", "muffin", "bagel", "toast", "noodle", "sandwich", "donut", "bun"),
    "dairy": ("cheese", "milk", "yogurt", "yoghurt", "butter", "cream", "paneer", "ice cream"),
    "egg": ("egg",),
    "nuts": ("nut", "almond", "walnut", "cashew", "hazelnut", "chestnut", "pistachio"),
    "peanuts": ("peanut",),
    "fish": ("fish", "salmon", "tuna", "sushi"),
    "shellfish": ("shrimp", "prawn", "crab", "lobster"),
    "soy": ("soy", "tofu"),
    "sesame": ("sesame",),
}
CATEGORY_ALLERGENS = {"baked_goods": ["gluten"], "dairy": ["dairy"]}
MEAT_WORDS = ("chicken", "beef", "pork", "meat", "ham", "sausage", "bacon", "lamb", "steak", "salami")
SHELF_HOURS = {"cooked_meal": 24, "baked_goods": 48, "produce": 96, "dairy": 72, "packaged_food": 720, "beverages": 168}
STORAGE = {"cooked_meal": "Keep refrigerated; reheat thoroughly", "baked_goods": "Keep in a bread bin or airtight box",
           "produce": "Store somewhere cool", "dairy": "Keep refrigerated", "packaged_food": "Cool, dry place",
           "beverages": "Refrigerate once opened"}
_LEAD = re.compile(r"^(arafed|araffe|there is|there are|this is|a photo of|an image of|a picture of|a close up of|close up of)\s+", re.I)
_TAIL = re.compile(r"\s+(on|in|with|sitting on|next to|against|over|under|inside|at)\s+(a|an|the|top of|some)\b.*$", re.I)


def clean_caption(caption: str) -> tuple[str, str]:
    """BLIP caption -> (short title, one-sentence description)."""
    c = caption.strip().rstrip(".")
    for _ in range(3):
        c = _LEAD.sub("", c).strip()
    desc = c[:1].upper() + c[1:] + "." if c else ""
    # Keep the noun phrase: cut at verbs/relative clauses, then trailing locations.
    title = re.sub(r"\b(bowl|plate|box|bag|basket|tray|jar|pot|container)\s+(?:filled with|full of)\s+", r"\1 of ", c, flags=re.I)
    title = re.split(r"\s+(?:being|that|which|sitting|standing|lying|laying|parked|placed)\b", title, maxsplit=1, flags=re.I)[0]
    title = _TAIL.sub("", title).strip()
    title = re.sub(r"^(a|an|the|some)\s+", "", title, flags=re.I)
    title = re.sub(r"^(bunch|couple|group|lot|set|variety) of\s+", "", title, flags=re.I)
    title = title[:1].upper() + title[1:]
    return title[:60], desc


def describe_with_open_models(hf: HFClient, image_url: str, categories: list[dict], kind_hint: str | None) -> dict:
    pool = [c for c in categories if not kind_hint or c["kind"] == kind_hint] or categories
    prompts = [f"a photo of {CATEGORY_PROMPTS.get(c['slug'], c['label'].lower())}" for c in pool]
    scores = hf.zero_shot_image(image_url, prompts)
    best = int(np.argmax(scores))
    cat, confidence = pool[best], float(scores[best])
    try:
        caption = hf.caption(image_url)
    except HFUnavailable:
        caption = ""
    title, desc = clean_caption(caption)
    text = caption.lower()
    food = cat["kind"] == "food"
    allergens = sorted({*CATEGORY_ALLERGENS.get(cat["slug"], []),
                        *(a for a, words in ALLERGEN_WORDS.items() if any(w in text for w in words))}) if food else []
    notes = []
    if confidence < 0.4:
        notes.append("Not sure what this is. Please check the category.")
    if cat["slug"] == "cooked_meal":
        notes.append("Cooked food: share within a day and keep it chilled.")
    raw = {
        "title": title or cat["label"],
        "description": desc,
        "kind": cat["kind"],
        "category": cat["slug"],
        "condition": None if food else "good",
        "allergens": allergens,
        "dietary_tags": ["contains_meat"] if food and any(w in text for w in MEAT_WORDS) else [],
        "storage_info": STORAGE.get(cat["slug"]) if food else None,
        "shelf_life_hours": SHELF_HOURS.get(cat["slug"]) if food else None,
        "safety_notes": notes,
        "confidence": round(confidence, 3),
    }
    return normalize(raw, categories)


def suggest_listing(hf: HFClient, settings, image_url: str, categories: list[dict],
                    kind_hint: str | None = None, notes: str | None = None) -> tuple[dict, dict]:
    """Returns (suggestion, meta).

    1. Hosted vision-language model (best quality; needs Inference credits).
    2. Open models, CLIP + BLIP: run locally for free, or hosted if available.
    3. Hosted caption + NLI zero-shot (last resort).
    """
    prompt = load_prompt(settings.listing_prompt_version)
    if hf.api_available():
        try:
            reply = hf.chat_json(settings.vision_model, build_messages(prompt, image_url, categories, kind_hint, notes))
            raw = extract_json(reply)
            if raw is None:
                raise HFUnavailable("model reply was not JSON")
            return normalize(raw, categories), {"model": settings.vision_model, "prompt_version": prompt["version"], "fallback": False}
        except HFUnavailable:
            pass

    try:
        suggestion = describe_with_open_models(hf, image_url, categories, kind_hint)
        where = "local" if hf.backend_used == "local" else "hosted"
        return suggestion, {"model": f"{settings.clip_model}+{settings.local_caption_model} ({where})",
                            "prompt_version": "open_models.v1", "fallback": True}
    except HFUnavailable:
        pass

    # Last resort: caption the image, then pick a category with zero-shot NLI.
    caption = hf.caption(image_url)
    pool = [c for c in categories if not kind_hint or c["kind"] == kind_hint] or categories
    ranked = hf.zero_shot(caption, [c["label"] for c in pool])
    best_label, score = ranked[0]
    cat = next(c for c in pool if c["label"] == best_label)
    title, desc = clean_caption(caption)
    raw = {"title": title, "description": desc, "category": cat["slug"], "confidence": score,
           "condition": "good" if cat["kind"] == "non_food" else None}
    return normalize(raw, categories), {
        "model": f"{settings.caption_model}+{settings.zero_shot_model}", "prompt_version": None, "fallback": True,
    }
