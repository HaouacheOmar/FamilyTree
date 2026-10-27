# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Windows desktop family-tree app: Django REST backend + React/Vite frontend, shipped as an Electron app that spawns a PyInstaller-frozen backend exe. UI languages: Arabic (default, RTL), English, French.

## Commands

Backend (repo root, inside a venv):

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver            # http://127.0.0.1:8000
python manage.py test familyTree      # all tests
python manage.py test familyTree.tests.PersonApiEnhancementTests.<test_name>   # single test
python manage.py send_birthday_notifications
```

Frontend (`familytree_front/`):

```bash
npm install
npm run dev          # Vite on :5173
npm run build        # -> familytree_front/dist
npm test             # birthday-math self-check (node src/birthdays.test.mjs)
npm run electron     # Electron shell; loads dist/, so `npm run build` first
```

Desktop release build (order matters — Electron bundles the backend exe from `../dist/`):

```bash
pyinstaller familytree_backend.spec              # -> dist/familytree_backend.exe
cd familytree_front && npm run build-electron    # -> familytree_front/release/ (NSIS installer)
```

Docker (hosted web version; needs `.env` from `.env.example`):

```bash
docker compose up -d --build     # http://localhost:8000/?token=<FAMILYTREE_API_TOKEN>
```

No linter is configured; `npm run build` does not catch undefined identifiers.

## Architecture

- **Runtime topology**: `familytree_front/electron.js` spawns `familytree_backend.exe` (built from `serve.py`: runs `migrate` then serves via Waitress on `127.0.0.1:8000`). The renderer loads `dist/index.html` from file, so `App.jsx` calls the backend at the hardcoded `API_BASE_URL = 'http://127.0.0.1:8000'`. `npm run electron` also expects `../dist/familytree_backend.exe` to exist.
- **API token**: Electron generates a random token per launch, passes it to the backend as `FAMILYTREE_API_TOKEN` and to the UI as `?token=` in the page URL; `familyTree/middleware.py` rejects `/api/` requests without the `X-FamilyTree-Token` header. Plain `runserver` (no env var) skips the check. `ALLOWED_HOSTS` is localhost-only.
- **Data location** (`config/settings.py`): SQLite DB and `media/` live in `DATA_DIR`, which is `FAMILYTREE_DATA_DIR` env var if set → else `%LOCALAPPDATA%\FamilyTree` when frozen → else repo root. Electron sets `FAMILYTREE_DATA_DIR` to `<drive>:\FamilyTreeData` when it finds a `familytree.key` marker file on a drive D:–Z: (portable USB mode).
- **Settings** default to the desktop case (DEBUG on, built-in SECRET_KEY, localhost-only hosts). Env overrides: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS`, `FAMILYTREE_HOST`/`FAMILYTREE_PORT` (serve.py bind), `FAMILYTREE_FRONTEND_DIR`.
- **Hosted mode (Docker)**: `Dockerfile` builds the UI with Node, then runs `serve.py` (migrate + Waitress) on Python slim as a non-root user. `FAMILYTREE_FRONTEND_DIR` makes `config/urls.py` serve the SPA at `/`, plus `/assets/` and `/media/` (the server-rendered `dashboard` view is shadowed there). The API token is set once in `.env` and required (`compose.yaml` refuses to start without it). `src/api.js` uses same-origin requests when served over http(s) and `127.0.0.1:8000` for Electron (`file:`) and `npm run dev`; it keeps the `?token=` value in localStorage. A 403 shows the "access key needed" notice instead of retrying.
- **Backend** is a single app `familyTree/`. Most logic is in `views.py`: `PersonViewSet` has custom actions (`duplicates`, `merge`, etc.) plus graph helpers (`_build_family_adjacency`, `_collect_branch_ids`). Function views handle `/api/stats/`, `/api/timeline/`, GEDCOM import/export (logic in `gedcom.py`), and full backup export/import. `Person.PARENT_FIELDS` / `PARTNER_FIELDS` / `LINK_FIELDS` list the self-FKs; use them instead of spelling the fields out.
- **Backup import/export** (`/api/export/`, `/api/import/`) snapshots/restores the DB through SQLite's backup API (safe under concurrent requests), validates the imported DB, runs `migrate` afterwards, and swaps `media/` in only after a successful copy.
- **Partner model is dual**: `Person` has legacy `spouse`/`husband`/`wife` FKs *and* a newer `Relationship` model (type + status + dates). `PersonSerializer.get_partners` merges both. `Relationship.save()` normalizes so `person1_id < person2_id`; a DB constraint forbids self-relationships. Keep both paths in mind when touching partner logic.
- Parents: `mother`/`father` plus `adoptive_mother`/`adoptive_father` self-FKs. `PersonMedia` holds extra photos/documents per person.
- **Frontend** (`familytree_front/src/`): `App.jsx` holds the header, people/search state and data refresh, and composes `PersonModal`, `TreeControls` (appearance, state in `useTreePreferences` in `hooks.js`), `AdvancedTools` (filters, relationship editor, duplicate finder), `BirthdayPanels` and `Dashboard`. `Tree.jsx` renders the tree (2D d3, 3D three.js). All HTTP goes through `api.js` (adds the token). All UI strings live in `i18n.js` keyed by `ar`/`en`/`fr`; a new string needs all three.
- **Refresh model**: after any write, `App.refreshAllData` refetches people and bumps `dataVersion`; panels that own their data (`RelationshipEditor`, `Dashboard`) refetch when it changes. `dataVersion` stays 0 until the backend first answers. `/api/people/` returns `X-Total-Count` (matches before `limit`) so the UI can say when the tree is truncated.
- **Birthday reminders**: OS notifications and the tray menu live in Electron (polls `/api/people/` every 6h). The day-count math is in `src/birthdays.mjs`, imported by the UI and `require()`d by `electron.js` (Node 22+ require(esm)); keep it free of browser/Node APIs and listed in package.json `build.files`. Feb 29 birthdays fall on Feb 28 in non-leap years, here and in `Person.birthdays_on`.
- `familyTree/templates/familyTree/dashboard.html` is a server-rendered page at `/`, separate from the React app.
- **Styling**: read `SYSTEM_DESIGN.md` before UI work. All colours/spacing/radii/durations are tokens on `:root` in `style/App.css` (no raw hex in components; tree cards read them via `var()` in d3 `.style()`, not `.attr()`). Animations use Motion (`motion/react`) presets from `src/motionPresets.js` inside `<MotionConfig reducedMotion="user">`; anything that unmounts goes in `<AnimatePresence>`. Icons are inline SVGs in `src/icons.jsx` (no emoji). Font is bundled (`@fontsource/ibm-plex-sans-arabic`) because the app runs offline. Use logical CSS properties so RTL mirrors for free; the tree SVG is deliberately `direction: ltr`.
