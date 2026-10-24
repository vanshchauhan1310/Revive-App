"""Seed a Supabase project with demo neighbours, listings and exchange history.

For development/staging only. Never run against production.

    ml-service/.venv/bin/python scripts/seed_demo.py            # first run: users + listings + history
    ml-service/.venv/bin/python scripts/seed_demo.py --more     # add another batch of fresh listings
    ml-service/.venv/bin/python scripts/seed_demo.py --region lugano --home you@example.com

Reads the repository root .env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL),
SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.

Demo accounts are <name>@demo.ecoshare.test (Lugano: <name>.lugano@demo.ecoshare.test) with password DEMO_PASSWORD (default
"ecoshare-demo"). Exchanges are driven through the real RPCs (request_listing,
respond_order, ...), so wallets, holds, the ledger and notifications stay consistent.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import psycopg

ROOT = Path(__file__).resolve().parent.parent
DEMO_DOMAIN = "demo.ecoshare.test"
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "ecoshare-demo")

IMG = {
    "bread": "1509440159596-0249088772ff",
    "croissant": "1555507036-ab1f4038808a",
    "cake": "1578985545062-69928b1d9587",
    "cookies": "1499636136210-6f4ee915583e",
    "muffins": "1607958996333-41aef7caefaa",
    "pizza": "1513104890138-7c749659a591",
    "pasta": "1621996346565-e3dbc646d9a9",
    "curry": "1585937421612-70a008356fbe",
    "biryani": "1563379091339-03b21ab4a4f8",
    "salad": "1512621776951-a57141f2eefd",
    "soup": "1547592166-23ac45744acd",
    "fruits": "1610832958506-aa56368176cf",
    "apples": "1560806887-1e4cd0b6cbd6",
    "bananas": "1571771894821-ce9b6c11b08e",
    "tomatoes": "1592924357228-91a4daadcfea",
    "vegetables": "1540420773420-3366772f4999",
    "milk": "1563636619-e9143da7973b",
    "eggs": "1582722872445-44dc5f7e3c8f",
    "cheese": "1486297678162-eb2a19b0a32d",
    "yogurt": "1488477181946-6428a0291777",
    "rice": "1586201375761-83865001e31c",
    "cereal": "1521483451569-e33803c0330c",
    "juice": "1600271886742-f049cd451bba",
    "coffee": "1559056199-641a0ac8b55e",
    "jacket": "1551028719-00167b16eac5",
    "tshirt": "1521572163474-6864f9cf17ab",
    "shoes": "1542291026-7eec264c27ff",
    "dress": "1595777457583-95e059d581b8",
    "books": "1512820790803-83ca734da794",
    "bookstack": "1495446815901-a7297e633e8d",
    "headphones": "1505740420928-5e560c06d30e",
    "laptop": "1496181133206-80ce9b88a853",
    "camera": "1516035069371-29a1b244cc32",
    "phone": "1511707171634-5f897ff02aa9",
    "chair": "1503602642458-232111445657",
    "sofa": "1555041469-a586c61ea9bc",
    "desk": "1518455027359-f3f8164ba6bd",
    "lamp": "1507473885765-e6ed057f782c",
    "plant": "1485955900006-10f4d324d411",
    "pots": "1556911220-bff31c812dba",
    "mugs": "1514228742587-6b1558fcca3d",
    "teddy": "1558060370-d644479cb6f7",
    "lego": "1587654780291-39c9404d746b",
    "bicycle": "1485965120184-e220f721d03e",
    "football": "1579952363873-27f3bade9f55",
    "yogamat": "1601925260368-ae2f83cf8b7f",
    "guitar": "1510915361894-db8b60106cb1",
    "backpack": "1553062407-98eeb64c6a62",
}

def img(key: str) -> str:
    return f"https://images.unsplash.com/photo-{IMG[key]}?w=800&q=70&auto=format&fit=crop"

# Neighbourhood centres per region (approximate)
REGIONS = {}
REGIONS["gurugram"] = [
    ("DLF Phase 1", 28.4722, 77.0937), ("DLF Phase 3", 28.4925, 77.0937), ("Sector 14", 28.4732, 77.0436),
    ("Sector 29", 28.4669, 77.0638), ("Sector 45", 28.4448, 77.0661), ("Sohna Road", 28.4126, 77.0435),
    ("Golf Course Road", 28.4520, 77.0985), ("Sushant Lok", 28.4636, 77.0789), ("Palam Vihar", 28.5068, 77.0337),
    ("MG Road", 28.4799, 77.0805),
]
REGIONS["lugano"] = [
    ("Lugano Centro", 46.0037, 8.9511), ("Paradiso", 45.9886, 8.9466), ("Cassarate", 46.0058, 8.9640),
    ("Besso", 46.0063, 8.9420), ("Molino Nuovo", 46.0138, 8.9548), ("Viganello", 46.0126, 8.9700),
    ("Massagno", 46.0122, 8.9435), ("Pregassona", 46.0225, 8.9702), ("Castagnola", 46.0050, 8.9800),
    ("Breganzona", 46.0090, 8.9280),
]

NAMES = {
    "gurugram": ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Sara", "Ishaan", "Nisha", "Vikram", "Tara", "Arjun", "Zoya"],
    "lugano": ["Luca", "Giulia", "Marco", "Chiara", "Matteo", "Sofia", "Lukas", "Elena", "Noah", "Anna", "Davide", "Lea"],
}
EMAIL_SUFFIX = {"gurugram": "", "lugano": ".lugano"}

# Extra local items per region, appended to the shared catalogue.
LOCAL_FOOD = {
    "lugano": [
        ("Zopf (Sunday braided bread)", "Baked this morning, too big for two of us.", "baked_goods", "bread", "1 loaf (500 g)", ["gluten", "dairy", "egg"], ["vegetarian"], "Wrap in a tea towel", 48),
        ("Swiss chocolate bars", "Assorted, unopened, from a gift box.", "packaged_food", "cookies", "6 bars", ["dairy", "nuts"], ["vegetarian"], "Cool, dry place", 2000),
        ("Raclette cheese, half wheel slice", "Left over from a raclette evening.", "dairy", "cheese", "600 g", ["dairy"], ["vegetarian", "gluten_free"], "Refrigerate", 168),
        ("Risotto ai funghi", "Ticino-style mushroom risotto.", "cooked_meal", "pasta", "3 portions", ["dairy"], ["vegetarian", "gluten_free"], "Refrigerate, reheat well", 20),
        ("Polenta with stew", "Classic grotto dish, made too much.", "cooked_meal", "soup", "2 portions", [], ["contains_meat", "gluten_free"], "Refrigerate", 20),
        ("Chestnuts (castagne)", "Collected near Monte Brè.", "produce", "fruits", "1 kg", ["nuts"], ["vegan"], "Cool, dry place", 168),
        ("Apples from the orchard", "From a farm in Malcantone.", "produce", "apples", "2 kg", [], ["vegan"], "Cool place", 240),
        ("Alpine milk, 2 litres", "Unopened, leaving for holidays.", "dairy", "milk", "2 x 1 litre", ["dairy"], ["vegetarian"], "Refrigerate", 72),
    ],
}
LOCAL_ITEMS = {
    "lugano": [
        ("Ski jacket, women's M", "Warm and waterproof, used two seasons.", "clothing", "jacket", "good", 45),
        ("Hiking boots, size 42", "Great for the trails around Monte Lema.", "clothing", "shoes", "good", 35),
        ("Italian & German novels", "Bundle of 8 paperbacks.", "books", "bookstack", "good", 0),
        ("Espresso cups set", "Six cups with saucers.", "kitchenware", "mugs", "like_new", 0),
        ("City bike for the lakefront", "Three gears, new tyres.", "sports", "bicycle", "good", 80),
        ("Balcony plants", "Basil and rosemary in terracotta pots.", "other", "plant", "good", 0),
    ],
}

# (title, description, kind, category, image, condition, price_credits, quantity, allergens, dietary, storage, shelf_hours)
FOOD = [
    ("Fresh-baked white bread loaf", "Baked this morning, made one too many.", "baked_goods", "bread", "1 loaf", ["gluten"], ["vegetarian"], "Keep in a bread bin", 48),
    ("Butter croissants, box of 4", "From a bakery order that was too big.", "baked_goods", "croissant", "4 pieces", ["gluten", "dairy", "egg"], ["vegetarian"], "Best eaten today", 24),
    ("Half chocolate cake", "Birthday leftovers, untouched half.", "baked_goods", "cake", "Half cake (~6 slices)", ["gluten", "dairy", "egg"], ["vegetarian"], "Refrigerate", 48),
    ("Homemade oat cookies", "Oats, raisins, a little jaggery.", "baked_goods", "cookies", "12 cookies", ["gluten"], ["vegetarian"], "Airtight jar", 96),
    ("Blueberry muffins", "Baked for a party that got cancelled.", "baked_goods", "muffins", "6 muffins", ["gluten", "dairy", "egg"], ["vegetarian"], "Room temperature", 48),
    ("Margherita pizza, half", "Ordered too much, kept in the fridge.", "cooked_meal", "pizza", "4 slices", ["gluten", "dairy"], ["vegetarian"], "Refrigerate, reheat well", 18),
    ("Penne arrabbiata", "Cooked at lunch, very mildly spicy.", "cooked_meal", "pasta", "2 portions", ["gluten"], ["vegan"], "Refrigerate", 20),
    ("Paneer butter masala", "Restaurant-style, made a big batch.", "cooked_meal", "curry", "3 portions", ["dairy", "nuts"], ["vegetarian"], "Refrigerate", 20),
    ("Veg biryani", "With raita on the side.", "cooked_meal", "biryani", "4 portions", ["dairy"], ["vegetarian"], "Refrigerate, reheat well", 20),
    ("Chicken biryani", "Hyderabadi style, leftover from a dinner.", "cooked_meal", "biryani", "3 portions", ["dairy"], ["halal", "contains_meat"], "Refrigerate, reheat well", 16),
    ("Greek salad bowl", "Prepared an hour ago, dressing separate.", "cooked_meal", "salad", "2 bowls", ["dairy"], ["vegetarian", "gluten_free"], "Refrigerate", 10),
    ("Tomato lentil soup", "Big pot, bring your own container.", "cooked_meal", "soup", "1.5 litres", [], ["vegan", "gluten_free"], "Refrigerate", 30),
    ("Mixed seasonal fruits", "From our society's fruit order.", "produce", "fruits", "2 kg", [], ["vegan"], "Cool, dry place", 72),
    ("Shimla apples", "Crisp and sweet, bought too many.", "produce", "apples", "1.5 kg", [], ["vegan"], "Refrigerate", 120),
    ("Ripe bananas", "Perfect for banana bread or smoothies.", "produce", "bananas", "1 dozen", [], ["vegan"], "Room temperature", 36),
    ("Garden tomatoes", "Grown on our terrace.", "produce", "tomatoes", "1 kg", [], ["vegan"], "Room temperature", 96),
    ("Vegetable box", "Carrots, beans, capsicum, spinach.", "produce", "vegetables", "About 3 kg", [], ["vegan"], "Refrigerate", 72),
    ("Unopened milk cartons", "Leaving town, 2 x 1 litre toned milk.", "dairy", "milk", "2 litres", ["dairy"], ["vegetarian"], "Refrigerate", 48),
    ("Farm eggs, one tray", "Free-range, bought yesterday.", "dairy", "eggs", "30 eggs", ["egg"], [], "Refrigerate", 168),
    ("Cheddar cheese block", "Unopened 400 g block.", "dairy", "cheese", "400 g", ["dairy"], ["vegetarian"], "Refrigerate", 240),
    ("Greek yogurt tubs", "Three sealed tubs, near best-before.", "dairy", "yogurt", "3 x 400 g", ["dairy"], ["vegetarian", "gluten_free"], "Refrigerate", 48),
    ("Basmati rice, 5 kg bag", "Sealed bag, we switched brands.", "packaged_food", "rice", "5 kg", [], ["vegan", "gluten_free"], "Cool, dry place", 2000),
    ("Breakfast cereal boxes", "Two unopened boxes of muesli.", "packaged_food", "cereal", "2 boxes", ["gluten", "nuts"], ["vegetarian"], "Cool, dry place", 1500),
    ("Orange juice, cold-pressed", "Two bottles, opened none.", "beverages", "juice", "2 x 1 litre", [], ["vegan"], "Refrigerate", 72),
    ("Coffee beans, medium roast", "Gift we will not use, 250 g sealed.", "beverages", "coffee", "250 g", [], ["vegan"], "Airtight, away from light", 2000),
]

ITEMS = [
    ("Winter jacket, men's L", "Warm puffer jacket, worn one season.", "clothing", "jacket", "good", 40),
    ("Bundle of cotton t-shirts", "Five plain tees, size M.", "clothing", "tshirt", "like_new", 0),
    ("Running shoes, size 9", "Lightly used, cushioned soles.", "clothing", "shoes", "good", 35),
    ("Party dress, size S", "Worn once to a wedding.", "clothing", "dress", "like_new", 30),
    ("Novels collection (10 books)", "Mix of fiction paperbacks.", "books", "books", "good", 0),
    ("School textbooks, class 8", "CBSE, all subjects, some notes in pencil.", "books", "bookstack", "fair", 0),
    ("Over-ear headphones", "Wired, great sound, no box.", "electronics", "headphones", "good", 60),
    ("Old laptop for parts or study", "Boots, slow, battery weak. Charger included.", "electronics", "laptop", "fair", 80),
    ("Point-and-shoot camera", "Works, with memory card.", "electronics", "camera", "good", 70),
    ("Android phone (spare)", "Older model, factory reset, cracked corner.", "electronics", "phone", "fair", 50),
    ("Wooden dining chair", "Sturdy, one small scratch.", "furniture", "chair", "good", 25),
    ("Two-seater sofa", "Grey fabric, you pick up (needs 2 people).", "furniture", "sofa", "good", 120),
    ("Study desk", "Compact desk with drawer.", "furniture", "desk", "good", 45),
    ("Table lamp", "Warm light, LED bulb included.", "furniture", "lamp", "like_new", 0),
    ("Indoor potted plants", "Three money plants in ceramic pots.", "other", "plant", "good", 0),
    ("Steel cooking pots set", "Set of 3 with lids.", "kitchenware", "pots", "good", 30),
    ("Coffee mugs, set of 6", "Matching ceramic mugs.", "kitchenware", "mugs", "like_new", 0),
    ("Teddy bear (large)", "Clean, from a smoke-free home.", "toys", "teddy", "like_new", 0),
    ("LEGO bricks box", "About 500 mixed pieces.", "toys", "lego", "good", 40),
    ("Kids bicycle, 16 inch", "Training wheels included.", "sports", "bicycle", "good", 55),
    ("Football", "Size 5, holds air well.", "sports", "football", "good", 0),
    ("Yoga mat", "6 mm, washed.", "sports", "yogamat", "good", 0),
    ("Acoustic guitar", "Beginner guitar, new strings.", "other", "guitar", "good", 90),
    ("School backpack", "Padded straps, laptop sleeve.", "other", "backpack", "like_new", 0),
]

FOOD_PRICES = [0, 0, 0, 0, 5, 10]  # most food is free


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def ensure_users(base: str, key: str, rnd: random.Random, region: str) -> list[dict]:
    headers = {"apikey": key, "authorization": f"Bearer {key}"}
    existing = {}
    page = 1
    while True:
        r = httpx.get(f"{base}/auth/v1/admin/users", params={"page": page, "per_page": 200}, headers=headers, timeout=30)
        r.raise_for_status()
        users = r.json().get("users", [])
        existing.update({u["email"]: u["id"] for u in users})
        if len(users) < 200:
            break
        page += 1
    out = []
    areas = REGIONS[region]
    for i, name in enumerate(NAMES[region]):
        email = f"{name.lower()}{EMAIL_SUFFIX[region]}@{DEMO_DOMAIN}"
        uid = existing.get(email)
        if not uid:
            r = httpx.post(f"{base}/auth/v1/admin/users", headers=headers, timeout=30, json={
                "email": email, "password": DEMO_PASSWORD, "email_confirm": True, "user_metadata": {"name": name},
            })
            r.raise_for_status()
            uid = r.json()["id"]
        area = areas[i % len(areas)]
        out.append({"id": uid, "name": name, "area": area})
    return out


def jitter(lat, lng, rnd, km=1.2):
    return round(lat + rnd.uniform(-km, km) / 111, 5), round(lng + rnd.uniform(-km, km) / 98, 5)


def as_user(cur, uid):
    cur.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": uid, "role": "authenticated"}),))
    cur.execute("set local role authenticated")


def rpc(conn, uid, sql, params=()):
    with conn.transaction():
        cur = conn.cursor()
        as_user(cur, uid)
        cur.execute(sql, params)
        row = cur.fetchone() if cur.description else None
        cur.execute("reset role")
        return row


def insert_listings(conn, users, rnd, now, region):
    rows = []
    for (title, desc, cat, image, qty, allergens, dietary, storage, shelf) in FOOD + LOCAL_FOOD.get(region, []):
        for _ in range(2):  # each food item listed by two different neighbours
            u = rnd.choice(users)
            lat, lng = jitter(u["area"][1], u["area"][2], rnd)
            price = rnd.choice(FOOD_PRICES)
            created = now - timedelta(hours=rnd.uniform(0.2, 20))
            expires = now + timedelta(hours=max(3, min(shelf, rnd.uniform(6, 96))))
            pickup_end = min(expires, now + timedelta(hours=rnd.choice([4, 8, 12, 24, 48])))
            rows.append(dict(owner_id=u["id"], title=title, description=desc, kind="food", category=cat, condition=None,
                             exchange_mode="credits" if price else "free", price_credits=price, quantity_label=qty,
                             images=[img(image)], neighborhood=u["area"][0], lat=lat, lng=lng, allergens=allergens,
                             dietary_tags=dietary, prepared_at=created if cat == "cooked_meal" else None,
                             expires_at=expires, storage_info=storage, pickup_start=now, pickup_end=pickup_end,
                             created_at=created, est_weight_kg=None))
    for (title, desc, cat, image, condition, price) in ITEMS + LOCAL_ITEMS.get(region, []):
        for _ in range(2):
            u = rnd.choice(users)
            lat, lng = jitter(u["area"][1], u["area"][2], rnd)
            p = price if rnd.random() < 0.8 else 0
            rows.append(dict(owner_id=u["id"], title=title, description=desc, kind="non_food", category=cat,
                             condition=condition, exchange_mode="credits" if p else "free", price_credits=p,
                             quantity_label=None, images=[img(image)], neighborhood=u["area"][0], lat=lat, lng=lng,
                             allergens=[], dietary_tags=[], prepared_at=None, expires_at=None, storage_info=None,
                             pickup_start=None, pickup_end=None, created_at=now - timedelta(hours=rnd.uniform(1, 24 * 12)),
                             est_weight_kg=None))
    cols = list(rows[0].keys())
    with conn.transaction():
        cur = conn.cursor()
        ids = []
        for r in rows:
            cur.execute(f"insert into public.listings ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))}) returning id",
                        [r[c] for c in cols])
            ids.append((cur.fetchone()[0], r))
        cur.execute("update public.listings set moderation = '{\"seed\": true}'::jsonb where id = any(%s)", ([i for i, _ in ids],))
    return ids


def impact_for(order_ids, conn):
    """Fill impact using the same factors table as ml-service (works without HF credits)."""
    sys.path.insert(0, str(ROOT / "ml-service"))
    from app.impact import estimate  # noqa: E402

    cur = conn.cursor()
    cur.execute("""select o.id::text, l.kind, l.category, l.title, l.description, l.quantity_label, l.est_weight_kg
                   from public.orders o join public.listings l on l.id = o.listing_id where o.id = any(%s::uuid[])""", (order_ids,))
    items = [dict(zip(["id", "kind", "category", "title", "description", "quantity_label", "est_weight_kg"], r)) for r in cur.fetchall()]
    with conn.transaction():
        for r in estimate(items, "impact_factors.v1"):
            cur.execute("update public.orders set impact_kg_co2e = %s, impact_kg_waste = %s where id = %s",
                        (r["kg_co2e"], r["kg_waste"], r["id"]))


def simulate_history(conn, users, listings, rnd):
    """Completed, cancelled, declined and open exchanges between demo users."""
    by_owner = {}
    for lid, r in listings:
        by_owner.setdefault(r["owner_id"], []).append((lid, r))
    pool = [x for x in listings]
    rnd.shuffle(pool)
    completed, stats = [], {"completed": 0, "no_show": 0, "declined": 0, "open_requests": 0, "accepted": 0}
    plan = ["complete"] * 14 + ["no_show"] * 3 + ["decline"] * 4 + ["request"] * 6 + ["accept"] * 3
    for action, (lid, r) in zip(plan, pool):
        owner = r["owner_id"]
        requester = rnd.choice([u["id"] for u in users if u["id"] != owner])
        try:
            order = rpc(conn, requester, "select id from public.request_listing(%s, %s)", (lid, rnd.choice([
                "Hi! Is this still available?", "I can pick it up this evening.", "Would love this, thank you!", None])))
            oid = str(order[0])
            if action == "request":
                stats["open_requests"] += 1
                continue
            if action == "decline":
                rpc(conn, owner, "select id from public.respond_order(%s, false)", (oid,))
                stats["declined"] += 1
                continue
            rpc(conn, owner, "select id from public.respond_order(%s, true)", (oid,))
            if action == "accept":
                stats["accepted"] += 1
                continue
            if action == "no_show":
                rpc(conn, owner, "select id from public.cancel_order(%s, 'no_show')", (oid,))
                stats["no_show"] += 1
                continue
            rpc(conn, owner, "select id from public.mark_ready(%s)", (oid,))
            code = rpc(conn, requester, "select public.issue_pickup_code(%s)", (oid,))[0]["code"]
            res = rpc(conn, owner, "select public.complete_exchange(%s, %s, %s)", (oid, code, str(uuid.uuid4())))[0]
            if res.get("ok"):
                completed.append(oid)
                stats["completed"] += 1
        except psycopg.Error as e:
            print(f"  skipped one exchange: {str(e).splitlines()[0]}")
    if completed:
        impact_for(completed, conn)
    return stats


def chat_and_engagement(conn, users, listings, rnd, real_users):
    cur = conn.cursor()
    lines = ["Hi! Is this still available?", "Yes, it is!", "Great, can I come by at 6?", "6 works, see you then.",
             "Thanks so much!", "Do you have a container I can borrow?"]
    # A few chats between demo users about listings
    for lid, r in rnd.sample(listings, 10):
        other = rnd.choice([u["id"] for u in users if u["id"] != r["owner_id"]])
        chat_id = rpc(conn, other, "select public.get_or_create_chat(%s, %s)", (r["owner_id"], lid))[0]
        with conn.transaction():
            for i, body in enumerate(lines[: rnd.randint(2, 5)]):
                sender = other if i % 2 == 0 else r["owner_id"]
                cur.execute("insert into public.messages (chat_id, sender_id, body, client_id) values (%s, %s, %s, gen_random_uuid())",
                            (chat_id, sender, body))
    # Views/saves for popularity and recommender history
    with conn.transaction():
        for _ in range(400):
            u = rnd.choice(users)
            lid, r = rnd.choice(listings)
            if r["owner_id"] == u["id"]:
                continue
            ev = rnd.choices(["view", "save", "impression"], [5, 1, 8])[0]
            cur.execute("insert into public.interactions (user_id, listing_id, event, context) values (%s, %s, %s, %s)",
                        (u["id"], lid, ev, json.dumps({"surface": "seed"})))
    # Your own account(s): a welcome message from a neighbour
    for ru in real_users:
        lid, r = rnd.choice([x for x in listings if x[1]["kind"] == "food"])
        chat_id = rpc(conn, r["owner_id"], "select public.get_or_create_chat(%s, %s)", (ru, lid))[0]
        with conn.transaction():
            cur.execute("insert into public.messages (chat_id, sender_id, body, client_id) values (%s, %s, %s, gen_random_uuid())",
                        (chat_id, r["owner_id"], f"Hi neighbour! My {r['title'].lower()} is still up for grabs if you want it."))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--more", action="store_true", help="add another batch of fresh listings")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--region", choices=sorted(REGIONS), default="gurugram")
    ap.add_argument("--home", help="also move this account (email) to the region so its items show as nearby")
    args = ap.parse_args()
    env = load_env()
    base = (env.get("SUPABASE_URL") or env["NEXT_PUBLIC_SUPABASE_URL"]).rstrip("/")
    key, db = env["SUPABASE_SERVICE_ROLE_KEY"], env["DATABASE_URL"]
    rnd = random.Random(args.seed if not args.more else None)
    now = datetime.now(timezone.utc)

    users = ensure_users(base, key, rnd, args.region)
    print(f"demo users: {len(users)} (password: DEMO_PASSWORD)")
    with psycopg.connect(db, prepare_threshold=None) as conn:
        cur = conn.cursor()
        ids = [u["id"] for u in users]
        cur.execute("select count(*) from public.listings where owner_id = any(%s::uuid[])", (ids,))
        already = cur.fetchone()[0]
        if already and not args.more:
            print(f"demo data already present ({already} listings). Use --more to add a fresh batch.")
            return
        with conn.transaction():
            for u in users:
                lat, lng = jitter(u["area"][1], u["area"][2], rnd, 0.5)
                cur.execute("update public.profiles set neighborhood = %s, lat = %s, lng = %s, reliability_score = %s where id = %s",
                            (u["area"][0], round(lat, 2), round(lng, 2), round(rnd.uniform(0.72, 0.98), 3), u["id"]))
        listings = insert_listings(conn, users, rnd, now, args.region)
        print(f"listings created: {len(listings)}")
        if not already:
            stats = simulate_history(conn, users, listings, rnd)
            print("exchanges:", stats)
            cur.execute("""select p.id::text from public.profiles p join auth.users u on u.id = p.id
                           where u.email not like %s and p.deleted_at is null""", (f"%@{DEMO_DOMAIN}",))
            real = [r[0] for r in cur.fetchall()]
            chat_and_engagement(conn, users, listings, rnd, real)
            print(f"chats, messages and {400} engagement events added; welcome message sent to {len(real)} real account(s)")
        if args.home:
            name, lat, lng = REGIONS[args.region][0]
            with conn.transaction():
                cur.execute("""update public.profiles p set neighborhood = %s, lat = %s, lng = %s
                               from auth.users u where u.id = p.id and lower(u.email) = lower(%s)""", (name, round(lat, 2), round(lng, 2), args.home))
                print(f"moved {args.home} to {name}: {cur.rowcount} profile(s) updated")
        cur.execute("select count(*) from public.wallet_reconciliation")
        print("ledger drift rows:", cur.fetchone()[0])


if __name__ == "__main__":
    main()
