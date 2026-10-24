# Brag Plan: EcoShare (60s narrated demo)

## What is this app?
EcoShare is a neighbourhood app for passing on surplus food and household items, free or for community credits. It has AI listing, a ranked "For you" feed, chat with moderation, pickup-code handover and impact tracking.

## The angle
The user asked for three things, all at 60s:
- a clear problem explanation;
- every feature demoed, with its explanation running alongside;
- a voiceover.

The video opens on the problem, then reveals the app. Each of the five features gets a split scene:
- the **left** side shows the phone doing the feature;
- the **right** side has a numbered caption card;
- the **voice** explains it in plain words.

The narration adds context and doesn't read the on-screen text aloud.

## Hook (first 2-3 seconds)
Real listing photos (bread, a jacket, books, a mug) drop into a bin, each landing with a soft thud. The line "Perfectly good stuff ends up in the bin." slams in. The voice starts at 0.6s: "Every day, perfectly good food and stuff gets thrown away…"

## Key moments
1. **The problem, part two:** two neighbour pins on a map of Lugano with a dashed gap between them, labelled "2 streets away".
2. **Smart listing:** a photo drops into the Share screen. The "Fill in details from photo" button gets tapped and a leaf spinner runs. Then the title, category and allergen chips fill in one by one, with an "AI · check every field" badge.
3. **For you feed:** the Explore header reads "Lugano". Listing cards with distance and freshness land one by one, and a "For you" chip glows.
4. **Request and chat:** the item detail screen. "Request this" is tapped, then chat bubbles arrive. One rude draft is blocked by a "Message held for review" chip.
5. **Safe handover:** a six-digit pickup code is typed in, a check pops, and coins fly to the owner's wallet. "+40 credits".
6. **Impact:** a CO₂ counter counts up, the EcoTree grows from seedling to tree, and badges flip in.

## Outro / punchline
The icon, then "EcoShare", then "Keep good stuff in use." The voice says it once and the bell rings out.

## User flow worth showing
Share a photo, AI drafts the listing → a neighbour finds it in "For you" → they request and chat → pickup code, then credits settle → impact grows.

## Tone
- **Preset:** `default`.
- **Creative direction:** a warm, explanatory product walkthrough, like a friendly founder demo.
- **Interpretation:** comfortable holds and soft spring motion. Each feature gets 6–10s, so every caption is easy to read while the voice explains it.

## Format: landscape, 1920×1080
## Duration: 60s
The user explicitly asked for one minute, which overrides the usual 15–25s window. The narration measures 52.7s across 9 lines.

## Visual identity (from `frontend/components/ui/theme.ts` and the app icon)
- **Background:** Cream `#F7F5EE`.
- **Primary:** Forest `#244D3A`.
- **Sage:** `#A8C3A0`.
- **Reward:** `#FFD166`.
- **Coral:** `#FF8C78`.
- **Text:** `#222B25`, with muted text `#5E6A62`.
- **Display font:** Plus Jakarta Sans 800/700.
- **Body font:** Inter 400–600.
- **Strongest visual:** the phone UI built from the app's tokens, with the real demo listing photos from `scripts/seed_demo.py` and the app icon.

## Fictional data
The neighbours Giulia and Luca are demo seed accounts. No real user data, emails or keys appear on screen.

## Share copy (draft)
"Good food and good stuff shouldn't end up in the bin. EcoShare passes them to a neighbour instead."

## Audio direction
- **Role:** a warm bed under continuous narration.
- **Music:** `happy-beats-business-moves-vol-9` (114.8 BPM).
  - Low under the voice (0.13), slightly higher before the first line and in the outro tail.
  - Fades in over 1s and out over 2.5s.
- **Voice:** Kokoro `af_heart`, nine lines placed per scene.
- **Music cue guidance:** from the bundled preset `cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`.
  - The beat grid runs every ~0.523s.
  - The reveal icon locks to the beat at 13.70s.
  - The feature cards snap to the beat grid.
- **Audio-reactive treatment:** subtle. The music's RMS drives a soft warmth glow behind the phone. There are no visualiser graphics.
- **SFX posture:** moderate and motion-matched:
  - soft heavy thuds for the bin drops;
  - a click for each tap;
  - drops for chips;
  - a card slide for each feed card;
  - chips-collide for coins;
  - a bell for the success and logo moments.
- **Restraint rule:** SFX never mask the voice. Keep them at 0.35–0.6 while the voice speaks.

## Voiceover script
| # | Start | Line |
|---|---|---|
| 1 | 0.6 | Every day, perfectly good food and stuff gets thrown away. Fresh bread. A warm jacket. A stack of books. |
| 2 | 7.7 | Meanwhile, a neighbour just two streets away could really use them. They simply never find each other. |
| 3 | 13.9 | Meet EcoShare. Share food and things with your neighbours. |
| 4 | 18.0 | Start with a photo. Free, open AI models fill in the title, category and allergens for you. You check every field before it goes live. |
| 5 | 27.8 | Explore shows what's near you. The For you feed ranks items by your interests, distance and freshness. |
| 6 | 34.2 | See something you like? One tap requests it. Agree a pickup time in chat, while AI screens messages for abuse. |
| 7 | 41.8 | At pickup, a one-time code confirms the handover. Credits only move once the exchange is done. No code, no payment. |
| 8 | 50.2 | And every share counts. See the carbon you've helped save, earn badges, and watch your EcoTree grow. |
| 9 | 56.7 | EcoShare. Keep good stuff in use. |

## Storyboard (30fps)

### Scene 1: Hook, the bin (0–7.4s)
- Bread, a jacket, books and a mug drop one by one into a sage bin outline, at 0.9, 2.5, 3.7 and 4.7s, in sync with the voice.
- The headline "Perfectly good stuff ends up in the bin." holds from 1.2s.
- Sequential: yes, four drops, each with a soft heavy thud.
- Transition: soft crossfade.

### Scene 2: The gap (7.4–13.4s)
- A stylised Lugano map with two pins, "You" and "Giulia", joined by a dashed line that draws in, and a "2 streets away" label.
- Headline: "…while a neighbour nearby could use it."
- At about 11.5s a small question mark pulses between the pins.
- Audio: two gentle drops for the pins.
- Transition: the pins converge, then the icon reveal.

### Scene 3: Reveal (13.4–17.6s)
- The app icon springs in at 13.70s (beat-locked).
- "EcoShare" appears, then the app's own tagline "Share food and things with your neighbours."
- Audio: impactSoft_medium on the icon.

### Scene 4: Feature 01, Snap and AI fills it in (17.6–27.4s)
- **Left (phone, Share screen):**
  1. The bread photo drops into the photo slot.
  2. The "Fill in details from photo" button is tapped at 20.2s and a spinner runs.
  3. Fields fill in with a stagger: Title "Fresh sourdough loaf", Category "Breads", Allergens "Gluten", Best before "48h".
  4. A badge reads "Drafted by AI · check every field".
- **Right:** caption card 01, "Snap. AI fills it in." Body: "Open Hugging Face models (CLIP + BLIP) draft the title, category and allergens — free, on our own server." Holds for 7s.
- Audio: a click, then drops for each field.

### Scene 5: Feature 02, For you nearby (27.4–33.8s)
- **Left:** the Explore screen with the header "Explore · Lugano Centro" and a "For you" chip. Four cards slide in on the beat grid:
  - Croissants · 0.3 km
  - Apples · 0.6 km
  - Headphones · 1.1 km
  - Plant · 0.8 km
- **Right:** card 02, "Discover what's near you." Body: "A For you feed ranked by your interests, distance and freshness."
- Audio: card-slide on each card.

### Scene 6: Feature 03, Request and chat (33.8–41.4s)
- **Left:**
  1. Item detail: the jacket, "Free", "Luca · 0.6 km".
  2. "Request this" is tapped at 35.6s and the button turns into "Requested ✓".
  3. The chat slides in: "Hi! Could I pick it up at 6?" / "Sure, see you at 6 🙂".
  4. A greyed bubble shows "Message held for review" with a shield.
- **Right:** card 03, "Request & chat." Body: "One tap reserves it. Agree a pickup time in chat — AI screens messages for abuse."
- Audio: a click, then drops for the bubbles.

### Scene 7: Feature 04, Safe handover (41.4–49.8s)
- **Left:**
  1. The pickup screen shows code boxes that fill in "4 8 2 9 1 7" one digit at a time.
  2. At 45.6s a check pops with "Exchange complete".
  3. Coins fly into the wallet pill, which counts 100 → 140.
- **Right:** card 04, "Safe handover." Body: "A one-time pickup code confirms it. Credits move only when the exchange is done."
- Audio: soft clicks on the digits, a bell for the check, chips for the coins.

### Scene 8: Feature 05, Impact (49.8–56.4s)
- **Left:** the profile screen.
  - A CO₂ counter counts up to "12.4 kg CO₂e avoided".
  - The EcoTree grows from seedling to sapling to tree.
  - Badges flip in: "First share", "Neighbour hero", "Zero waste week".
- **Right:** card 05, "Watch your impact grow." Body: "CO₂ avoided, an EcoTree that grows, and badges for sharing."
- Audio: chips-stack for the counter, glass for the badges.

### Scene 9: Outro (56.4–60.0s)
- The icon, "EcoShare", and "Keep good stuff in use."
- Audio: the bell, and the music fades out.

**Music mood:** warm and upbeat.
**Audio summary:** a soft bed carries a friendly voice from problem to payoff, small UI sounds make each feature feel tactile, and a bell lands the logo.
