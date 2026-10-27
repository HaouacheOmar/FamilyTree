# Hyperframes Composition Brief: Family Tree (شجرة العائلة)

## Objective
Create a 40-second launch-style brag video for Family Tree. The length was requested by the user and is longer than /brag's usual 15–25s window.

## Output
- **Composition directory:** `brag-output/composition/`
- **Rendered video:** `brag-output/brag.mp4`
- **Format:** landscape, 1920x1080, 30fps
- **Duration:** 40s

## Source Material
- **Project root:** `FamilyTree/` (Django + React/Vite + Electron)
- **Primary files read:**
  - `familytree_front/style/App.css` (design tokens)
  - `familytree_front/src/i18n.js` (copy)
  - `familytree_front/src/App.jsx`, `PersonModal.jsx`, `Tree.jsx`, `BirthdayPanels.jsx`
  - `SYSTEM_DESIGN.md`, `README.md`
- **Product name:** Family Tree / شجرة العائلة
- **Tagline (app subtitle, `UI_COPY.en.appSubtitle`):** "Explore family connections, add members, and keep your family history organized."
- **Key UI moments:** real captures of the running app (current build, throwaway database, fictional family) in `composition/assets/ui/`:

| File | What it shows |
|---|---|
| `app-en.png` | full app, English, 1920x1080 |
| `add-form-names-empty.png` | the Add Person form with the name fields empty, ready for typing |
| `add-form.png` | the same form, completely filled in |
| `tree-before.png` | the tree before Yasmine is added |
| `tree-after.png` | the tree after Yasmine is added |
| `app-ar.png` | full app in Arabic, empty search |
| `app-ar-search.png` | Arabic, searching جدة narrows to Fatima Haddad |
| `birthdays.png` | the reminder panel |

- **Copy that must appear verbatim:**
  - "شجرة العائلة" (`UI_COPY.ar.appTitle`)
  - "Family Tree" (`UI_COPY.en.appTitle`)
  - "Explore family connections, add members, and keep your family history organized." (`UI_COPY.en.appSubtitle`)
  - "Search by relation (aunt, grandpa, spouse) or family name" (`UI_COPY.en.searchPlaceholder`)
  - "Export GEDCOM" / "Import GEDCOM", "Export Tree" / "Import Tree" (header actions; the feature cards may group them)

## Creative Direction
- **Tone preset:** polished
- **Creative direction:** warm heritage keepsake film; a family album coming to life
- **Interpretation:** confident, unhurried reveals; soft blur crossfades (calm energy, 0.6–0.8s, `sine`/`power1`); a gentle Ken Burns on the UI. One idea per scene, generous holds, no exits before transitions except the final fade.
- **Angle:** the app as a family keepsake. Arabic first, it grows a generation as you add someone, it finds the grandmother when you type جدة, it remembers birthdays, and it keeps your data with you.
- **Hook:** a branch line draws, شجرة العائلة writes in, then "Every family has a story." → "Keep it."
- **Outro:** the logo, "Family Tree / شجرة العائلة", and the subtitle line.
- **Avoid:**
  - generic SaaS language ("streamline", "powerful", "seamless")
  - abstract filler visuals
  - redesigning the app (show the real UI captures)
  - any real personal data (all names are fictional)

## Visual Identity (exact tokens from `App.css`)
- **Background:** `#F7F4EE` parchment; surface `#FFFFFF`; muted surface `#F1ECE3`; border `#E3DCCF`
- **Text:** `#1F2A24`; muted `#5C665F`
- **Accent:** forest green `#2F6B4F` (hover `#26583F`, soft `#E5EFE8`); celebration amber `#B45309`, `#92400E`, soft `#FDF1E1`
- **Tree link:** `#CBBFA8`; couple link `#C98B8B`
- **Font:** IBM Plex Sans Arabic for display and body, shipped locally as woff2 in `assets/fonts/` (it covers Arabic and Latin). Display 600/700; body 400/500.
- **Visual references:**
  - the app logo (`assets/logo.svg`, a small green tree)
  - rounded person cards with gender tints
  - curved tree links
  - the olive-branch memorial mark

## Storyboard
The storyboard in `brag-output/brag-plan.md` is the creative contract.

| # | Scene | Starts at | Length | What it shows |
|---|---|---|---|---|
| 1 | Hook | 0.0s | 4.0s | branch draws; شجرة العائلة; "Every family has a story." → "Keep it." |
| 2 | Reveal | 4.0s | 5.0s | logo + "Family Tree"; `app-en.png` rises into a window frame; slow push; subtitle line |
| 3 | Add a person | 9.0s | 7.0s | form rises; "Yasmine" and "Benali" typed into the fields; click Save; `tree-before` → `tree-after` with Yasmine's card highlighted |
| 4 | The tree grows | 16.0s | 7.0s | `tree-after` revealed generation by generation; callouts on "1948 - 2015" + memorial mark and the couple link |
| 5 | Search in Arabic | 23.0s | 5.0s | `app-ar` → جدة typed into the search pill → `app-ar-search`; Fatima's card highlighted; placeholder caption |
| 6 | Birthdays | 28.0s | 5.0s | `birthdays.png` slides in; amber glow on the "turns 74" chip |
| 7 | Keeps it with you | 33.0s | 4.5s | 3 feature cards one by one, then held together |
| 8 | Outro | 37.5s | 2.5s | logo + names + subtitle line; music fades out |

## Audio
- **Audio role:** warm bed with sparse, soft accents
- **Audio arc:** fades in under the hook, lifts as the tree grows, tactile accents through add-person and search, a single soft bell on the logo, then fades out
- **Music:** `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` at about 0.28, 0.8s fade-in, fade-out over the last 1.5s (volume automation)
- **Music cue guidance:** preset `<brag-skill>/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`, 109.96 BPM
  - strong cues: 17.47 (tree rows), 22.93 (search result), 37.11 (logo)
  - beat-grid for the feature cards: 33.83 / 34.92 / 36.01 (every other beat)
- **Audio-reactive treatment:** subtle. `assets/audio-reactive.js` (RMS + bass, 30fps, normalized) breathes the warm radial glow behind scenes and the logo's halo. No visualizer graphics.
- **Audio-coupled moments:**
  - Scene 3: keypresses (thinned) for the typed name; click on Save; soft impact when the new card pops
  - Scene 4: soft impact on the first and last generation rows
  - Scene 5: a few keypresses for جدة; bong when the result appears
  - Scene 7: card-slide on each card
  - Scene 8: `impactBell_heavy_000` on the logo landing
- **SFX:** pre-selected low/medium HF-risk files in `assets/sfx/`; volumes 0.45–0.7 (polished)

## Hyperframes Instructions
Standalone single-file composition (`index.html`); one paused GSAP timeline registered at `window.__timelines["main"]`.
- Local GSAP: `assets/vendor/gsap.min.js`.
- `@font-face` declarations point at the local woff2 files.
- Scenes are plain absolutely-positioned divs. Scene 1 is visible by default; scenes 2+ start at opacity 0 and are revealed by calm blur crossfades.
- Every text line holds within the reading floor (about 0.3s per word, 0.8s minimum).
- Audio clips each have an `id`, a unique `data-track-index` when they overlap, and relative paths.
- Run `npx hyperframes check` as the gate before rendering.
