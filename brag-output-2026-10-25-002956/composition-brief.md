# Hyperframes Composition Brief: EcoShare

## Objective
Create a 60-second narrated demo for EcoShare. It explains the problem, then demos each feature, with an on-screen explanation running alongside each one.

## Output
- **Composition directory:** `composition/`.
- **Rendered video:** `brag.mp4`.
- **Format:** landscape, 1920×1080, 30fps.
- **Duration:** 60s. The user explicitly asked for one minute.

## Source material
- **Project root:** `/Users/adrikapradhan/Desktop/Ecoshare-App`.
- **Files read:** `frontend/components/ui/theme.ts`, `frontend/app/*` screens, `ml-service/app/suggest.py`, `scripts/seed_demo.py` (photos), `frontend/assets/images/icon.png`, and the README.
- **Tagline:** "Share food and things with your neighbours."
- **UI recreated:**
  - Share with "Fill in details from photo"
  - Explore "For you"
  - Listing detail with "Request this"
  - Chat
  - Pickup code
  - Profile with the EcoTree
- **Grounded claims:**
  - AI listing comes from CLIP + BLIP (Hugging Face) running locally.
  - The ranking uses interests, distance and freshness.
  - toxic-bert moderation holds messages.
  - A one-time pickup code is required to settle.
  - Credits use a ledger.
  - CO₂ impact comes from `impact_factors.v1.json`.
  - Badges and the EcoTree come from `achievements.tsx` and `treeStage`.

## Creative direction
- **Tone:** `default`, a warm explanatory founder demo.
- **Structure:** split scenes, with the phone on the left and a numbered caption card on the right.
- **Avoid:** generic SaaS language, abstract filler and real personal data.

## Visual identity
- **Palette:** Cream `#F7F5EE`, Forest `#244D3A`, Sage `#A8C3A0`, Reward `#FFD166`, Coral `#FF8C78`, Text `#222B25`.
- **Fonts:** Plus Jakarta Sans and Inter, as local woff2 files.

## Storyboard
See `brag-plan.md`. It has nine scenes, timed to the nine voiceover lines.

## Audio
- **Voice:** Kokoro `af_heart`, in `assets/vo/l1–l9.wav` at the plan's start times.
- **Music:** `assets/music/happy-beats-business-moves-vol-9-by-ende-dot-app.mp3`.
  - Volume 0.13 under the voice; fades in over 1s and out over 2.5s.
- **Cue preset:** `<skill>/assets/music/cues/happy-beats-business-moves-vol-9-by-ende-dot-app.music-cues.json`.
  - The reveal is beat-locked at 13.70s.
  - The feed cards use the beat grid.
- **SFX:** in `assets/sfx/`, chosen from the low and medium HF-risk picks in `sfx-analysis.md`, at 0.35–0.6 under the voice.
- **Audio-reactive:** a subtle glow behind the phone breathes with the music's RMS. If extraction isn't available, a static glow is fine.
