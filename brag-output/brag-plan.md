# Brag Plan: Family Tree (شجرة العائلة)

## What is this app?
A desktop family-tree keeper. You add relatives, it draws the generations, searches them by relation in Arabic, English or French, and reminds you of birthdays. It runs offline on your own computer, or self-hosted in Docker.

## The angle
A family album coming to life. The video treats the app as a keepsake rather than software: warm parchment, forest green, one person added and the tree growing around them. The specific, ownable details:
- **Arabic first:** the title is شجرة العائلة and the search understands جدة ("grandma").
- **It remembers birthdays.**
- **It keeps your data with you:** offline desktop app, export/backup, GEDCOM.

No generic "manage your data" language: every claim on screen is a string or feature from the app.

## Hook (first 2-3 seconds)
On parchment, a single green line draws a branch, and شجرة العائلة writes in large. Under it, in English: "Every family has a story." It holds long enough to read, then: "Keep it." The Arabic title in the opening frame is what makes it unmistakably this app.

## Key moments (the middle)
- **Add a person:** the real "Add Person" form. The name "Yasmine Benali" types in, Save is clicked, and her card pops into the tree.
- **The tree grows:** three generations fan out with real cards (blue, rose and memorial-grey), the lifespan "1948 - 2015", and the olive-branch "in memory" mark.
- **Search by relation in Arabic:** جدة types into the search box and the tree narrows to Fatima Haddad, the grandmother.
- **Birthdays:** the reminder panel slides in with "Fatima Haddad · turns 74" and "Amina Saidi · in 4 days".

## Outro / punchline
Three quiet feature cards (GEDCOM import & export, backup & restore, works offline: desktop or Docker), then the logo, "Family Tree / شجرة العائلة", and the app's own subtitle: "Explore family connections, add members, and keep your family history organized."

## User flow worth showing
1. **Entry:** the app opens on the tree, with the birthday reminder at the top.
2. **Key action:** Add Person, type the name, Save, and the card appears in the tree.
3. **Result:** the tree grows a generation; search by relation (جدة) finds the grandmother; the birthday reminder shows who turns 74 today.

## Tone
- **Preset:** polished
- **Creative direction:** warm heritage keepsake film; a family album coming to life
- **Interpretation:** confident, unhurried reveals with generous holds and soft crossfades and slides. No jokes, no caps, no hard cuts. Motion is gentle (soft springs, slow push-ins on the UI) and sound is a calm bed with a few soft wooden/paper accents. More scenes than a usual polished brag because the user asked for 40s; each scene still makes one point.

## Format: landscape — 1920x1080
## Duration: 40s (user-requested; longer than /brag's usual 15–25s window)

## Visual identity (from the project: familytree_front/style/App.css tokens)
- **Background:** `#F7F4EE` (parchment), with `#F1ECE3` muted surface
- **Accent:** `#2F6B4F` (forest-green primary); celebration accent `#B45309` / soft `#FDF1E1`
- **Text:** `#1F2A24`; muted `#5C665F`
- **Tree cards:** male `#E3EEF7` / `#8DB3D6`, female `#F8E9EF` / `#D9A3BB`, deceased `#ECEBE7` / `#8E8A80`; links `#CBBFA8`, couple link `#C98B8B`
- **Display font:** IBM Plex Sans Arabic (600/700), the app's bundled font, which covers Arabic and Latin
- **Body font:** IBM Plex Sans Arabic (400/500)
- **Strongest visual element:** the tree itself (rounded person cards, connected by curved links, generation by generation), plus the logo (a small green tree, `src/assets/app-logo.svg`)

## Share copy (draft)
Built a family tree app that speaks Arabic first, remembers everyone's birthday, and keeps your family's story on your own machine, not someone else's cloud. 🌳 شجرة العائلة

## Audio direction
- **Role:** warm bed with sparse, soft accents
- **Music:** `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady, clean; the polished pick), 110 BPM
- **Music treatment:** starts at 0 with a short fade-in, sits low (about 0.28), and fades out over the last ~1.5s after the logo lands
- **Music cue guidance:** preset `cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (tempo 109.96).
  - Strong cues to consider: **17.47s** (tree fan-out), **22.93s** (search result), **37.11s** (logo lands).
  - Beat grid for the outro feature cards: 32.74 → 33.83 → 34.92 (every other beat, about 1.1s apart, so each card can be read).
  - Restraint: polished tone, so only these 1–3 locks.
- **Audio-reactive treatment:** subtle; music RMS gently breathes the warm glow behind the tree and the logo's presence. No waveform or equalizer visuals.
- **SFX posture:** sparse, motion-matched, soft. Light keypresses for typed text (thinned, not every character), one soft click on Save, a soft wood/drop as the new card lands, one gentle accent when the search result resolves, and a soft bell/bong as the logo lands.
- **Audio-coupled moments:** typed name and typed جدة; Save click and card pop; feature cards arriving one by one; logo landing.
- **Restraint rule:** no punches, glitches or casino sounds. Nothing louder than the music swell. SFX 0.5–0.7.

## Storyboard

### Scene 1 — Hook — 4.0s
On parchment, a thin forest-green branch line draws across, and شجرة العائلة writes in large (display weight). Below it: "Every family has a story." (holds about 1.6s), which then resolves to "Keep it." (holds about 1s).
- **Sequential/interaction:** yes. The branch draws, the Arabic title reveals, then the two English lines arrive one after the other.
- **Audio intent:** an inviting, quiet start.
- **Audio-coupled idea:** music fades in; no SFX, or one very soft drop when the title settles.
- **Music:** calm bed.
- **Transition mood:** soft → Scene 2

### Scene 2 — Reveal — 5.0s
The app logo and "Family Tree" appear, then a real screenshot of the app (English UI: header, birthday reminder, toolbar, tree) glides up into a framed window with a soft shadow. A slow push toward the tree. The caption is the app's own subtitle: "Explore family connections, add members, and keep your family history organized." (it holds about 3s, long enough to read).
- **Sequential/interaction:** none; one confident reveal.
- **Audio intent:** an opening breath.
- **Audio-coupled idea:** a soft whoosh/drop as the window settles.
- **Transition mood:** soft slide → Scene 3

### Scene 3 — Add a person — 7.0s
The real "Add Person" form (from the app). The cursor clicks "Add Person"; the form rises; "Yasmine" types into First name and "Benali" into Last name; the date is filled; the cursor clicks Save. The form closes and a new rose card ("Yasmine Benali · * 2004") pops into its place in the tree.
- **Sequential/interaction:** yes. Simulated click, typing, click, card pop.
- **Audio intent:** tactile and satisfying.
- **Audio-coupled idea:** soft keypresses on the typed name (thinned); a click on Add Person and on Save; a soft wood/drop when the card lands.
- **Transition mood:** clean → Scene 4

### Scene 4 — The tree grows — 7.0s
Pull back to the full tree: three generations fan out in order (grandparents, then children, then grandchildren), each row arriving as a set. Light callouts point at real details: the lifespan "1948 - 2015" with the olive-branch mark ("In memory"), and the couple link between partners. Caption: "Three generations, one place." (connective line, not a product claim).
- **Sequential/interaction:** yes. Generations arrive one row at a time, each held.
- **Audio intent:** a gentle lift as the family appears.
- **Audio-coupled idea:** major reveal beat-locked near 17.47s; soft card-place sounds on the rows (first and last only).
- **Transition mood:** soft crossfade → Scene 5

### Scene 5 — Search by relation, in Arabic — 5.0s
The app in Arabic (RTL). The search pill reads its placeholder; جدة types in; the tree narrows to Fatima Haddad's card, which gets a soft green highlight. Caption (from the app's search placeholder, English): "Search by relation (aunt, grandpa, spouse) or family name", with a small subcaption "in Arabic, English or French."
- **Sequential/interaction:** yes. Typed Arabic query, then the result appears.
- **Audio intent:** a little moment of delight.
- **Audio-coupled idea:** two or three soft keypresses; one gentle accent when the result resolves, near 22.93s.
- **Transition mood:** soft slide → Scene 6

### Scene 6 — Birthdays — 5.0s
The real birthday reminder panel slides in: "Birthday reminders", "Today": the "Fatima Haddad · turns 74" chip; "Coming up": "Amina Saidi · in 4 days · 48". The chip gets a warm amber glow. Caption: "It remembers birthdays." (connective).
- **Sequential/interaction:** yes. Today's chip, then the upcoming row (each held at least 1s).
- **Audio intent:** warm, celebratory but quiet.
- **Audio-coupled idea:** a soft glass/bell sparkle on the chip.
- **Transition mood:** soft crossfade → Scene 7

### Scene 7 — Keeps it with you — 4.5s
Three clean cards arrive one by one on the beat grid, about 1.1s apart:
1. "GEDCOM import & export"
2. "Backup & restore"
3. "Works offline · desktop or Docker"

All three hold together for at least 1.2s after the last one lands. These are grounded in the app's Export/Import Tree, Export/Import GEDCOM, the Electron desktop app and the Docker setup.
- **Sequential/interaction:** yes. Cards one by one.
- **Audio intent:** steady confidence.
- **Audio-coupled idea:** a soft card-place on each card.
- **Transition mood:** soft → Scene 8

### Scene 8 — Outro — 2.5s
The logo, "Family Tree" with شجرة العائلة beneath it, then the subtitle line "keep your family history organized." (shortened from the app's subtitle). Beat-locked logo landing near 37.11s. A long, quiet hold while the music fades.
- **Sequential/interaction:** none.
- **Audio intent:** a resolved, warm ending.
- **Audio-coupled idea:** a soft bell/bong on the logo landing; music fades out.
- **Transition mood:** end.

**Durations:** 4.0 + 5.0 + 7.0 + 7.0 + 5.0 + 5.0 + 4.5 + 2.5 = **40.0s**

**Music mood for this video:** calm, warm, steady
**Audio summary:** a low, warm bed that fades in under the Arabic title, picks up gently as the tree grows, carries soft tactile accents through the add-person and search moments, and settles under a single bell on the logo before fading out.

## Source material and privacy
- **UI captures:** taken from the real app (current build) running against a throwaway local database, seeded with **fictional** people (Ahmed Benali, Fatima Haddad, Karim Benali, Amina Saidi, Nadia Benali, Yasmine Benali, Omar Benali).
- **Not used:** none of the user's real family data, tokens or hostnames.
