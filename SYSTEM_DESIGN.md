# FamilyTree design system

How the FamilyTree desktop app looks, moves and reads. Use this when you add or change UI.

The source of truth is code:
- **Tokens and components:** `familytree_front/style/App.css`
- **Motion presets:** `familytree_front/src/motionPresets.js`
- **Icons:** `familytree_front/src/icons.jsx`
- **Strings:** `familytree_front/src/i18n.js`

If this document and the code disagree, the code wins. Fix this file.

---

## 1. Principles

1. **The tree comes first.** The tree sits directly under its toolbar. The tools (filters, relationship editor, duplicate finder) start collapsed below it, and stats come last. Anything new goes below the tree unless it is about the tree itself.
2. **Warm and calm.** It is a family archive, not a dashboard. The page uses parchment backgrounds, a forest-green primary colour, an amber accent kept for celebrations (birthdays), soft shadows and rounded corners. There is no harsh black, pure-blue links or "alert red" decoration.
3. **Arabic first, three languages always.** Arabic (right-to-left) is the default; English and French are equal citizens. Every layout must work mirrored.
4. **Offline.** It is a desktop app. Nothing loads from the network except the local backend, and fonts are bundled.
5. **Show what is known.** Empty data is hidden, not displayed as walls of "—" (for example, the person details only list filled fields).
6. **Gentle feedback.** Results show as toasts, not `alert()` boxes. Destructive actions still ask with the native `confirm()`.

## 2. Tokens

All values live on `:root` in `App.css`. Components use `var(--…)`; **no raw hex values outside the token block** (the only exception is `three.js` materials, see §9).

### Colour

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#F7F4EE` | Page background (parchment) |
| `--color-surface` | `#FFFFFF` | Cards, header, modal, inputs |
| `--color-surface-muted` | `#F1ECE3` | Hover fills, search field, secondary areas |
| `--color-border` | `#E3DCCF` | Default borders and dividers |
| `--color-border-strong` | `#8E8574` | Hovered input and button borders |
| `--color-text` | `#1F2A24` | Body text |
| `--color-text-muted` | `#5C665F` | Labels, captions, meta text |
| `--color-primary` / `-hover` | `#2F6B4F` / `#26583F` | Primary actions, selected state, focus ring |
| `--color-primary-soft` | `#E5EFE8` | Selected pill backgrounds |
| `--color-accent` / `-strong` / `-soft` | `#B45309` / `#92400E` / `#FDF1E1` | Birthdays and celebrations only; truncation notice |
| `--color-danger` / `-soft` | `#B42318` / `#FDEEEC` | Delete buttons and error toasts |

**Measured contrast** (WCAG 2.x; normal text needs 4.5:1, UI elements need 3:1):

| Text / element | On | Ratio |
|---|---|---|
| `--color-text` | `--color-bg` | 13.5 |
| `--color-text-muted` | surface, bg, surface-muted | 6.0 / 5.4 / 5.1 |
| white | `--color-primary` | 6.3 |
| `--color-primary` | `--color-primary-soft` | 5.4 |
| white | `--color-accent` | 5.0 |
| `--color-accent-strong` | `--color-accent-soft` | 6.4 |
| white | `--color-danger` | 6.6 |
| `--color-danger` | `--color-danger-soft` | 5.8 |
| `--color-border-strong` | white | 3.7 (UI element) |

Re-check any new pair before using it.

**Tree cards** (read by d3 through `var()` in `Tree.jsx`):

| Token pair | Use | Text contrast |
|---|---|---|
| `--tree-card-male` / `-border` | Male | 12.6 |
| `--tree-card-female` / `-border` | Female | 12.7 |
| `--tree-card-other` / `-border` | Gender not set | |
| `--tree-card-deceased` / `-border` with `--tree-text-deceased` | Deceased | 8.0 |
| `--tree-link`, `--tree-couple-link` | Connectors | |

The tree canvas background is the user's choice (`--tree-bg`, from the swatches in `hooks.js`). The swatches are pale tints, so card text stays readable on any of them.

### Typography

- **Family:** `IBM Plex Sans Arabic` for every language. It covers Arabic and Latin in one design, so mixed names ("Ahmed بن علي") don't switch fonts mid-line. It is bundled through `@fontsource/ibm-plex-sans-arabic` (weights 400, 500, 600 and 700, imported in `main.jsx`).
- **Scale:**

| Token | Size | Typical use |
|---|---|---|
| `--text-xs` | 0.75rem | Field labels, palette titles, meta |
| `--text-sm` | 0.875rem | Buttons, inputs, list rows |
| `--text-md` | 1rem | Body text, card titles |
| `--text-lg` | 1.125rem | App title |
| `--text-xl` | 1.375rem | Modal headings |

- **Weights:** 400 for body, 500 for secondary buttons, 600 for buttons and labels, 700 for headings and stat values.
- Body line-height is 1.5. Numbers in stats and the timeline use `tabular-nums`.

### Spacing, shape, depth

- **Spacing:** a 4px base. `--space-1` to `--space-6` = 4, 8, 12, 16, 24 and 32px. Cards use 12–16px padding; sections are 16px apart.
- **Radius:** `--radius-sm` 8px (inputs, small buttons), `--radius-md` 12px (list rows, toasts), `--radius-lg` 16px (cards, modal), `--radius-pill` (chips, toggles, search).
- **Shadows:** `--shadow-sm` for resting cards, `--shadow-md` for dropdowns and toasts, `--shadow-lg` for the modal only.
- **Controls:** `--control-height` is 38px. This is a mouse-first desktop app; keep click targets at least 30px, with 8px or more between them.

## 3. Layout

Top to bottom:

1. **Header (sticky).** Logo and title, search, then actions: language, export/import, and Add Person as the single primary button. Below 1360px the actions move to their own row, so the search never gets squeezed.
2. **Birthday reminder.** Only when there are birthdays today or coming up, and the user can dismiss it for the day. "Today" and "Coming up" sit side by side on wide screens.
3. **Tree toolbar.** Background, shape, orientation, 2D/3D switch, reset.
4. **Tree.** The structure panel sits on the inline-start side (left in LTR, right in RTL) and the canvas fills the rest. On first render the canvas zooms to fit the whole tree.
5. **Family tools.** Three cards, collapsed by default.
6. **Dashboard.** Stats, today's birthdays, recent timeline events.

**Breakpoints:**
- **1360px:** the header actions wrap to a second row.
- **920px:** the header is no longer sticky; tools, dashboard and the tree's structure panel stack into one column.
- **700px:** forms and modal details become single-column, and the header buttons split into halves.

## 4. Components

| Component | Rules |
|---|---|
| **Buttons** | Exactly one **primary** per area (`.btn-primary`, `.btn-save`, `.add-member-btn`). Everything else is **secondary**: white surface, border, muted hover. **Danger** (`.btn-delete`) is soft red and turns solid on hover. Every button scales to 0.97 on press. |
| **Pills and toggles** | `.shape-btn`, `.birthday-reminder-range-btn` and `.dropdown-option` share one selected style: soft primary fill, primary border and text. |
| **Inputs** | Always a visible label. Wrap the field in `<label class="form-field">` (or `advanced-tools-field`) with a `<span>` caption, so the label is associated. Placeholders are never the label. Focus shows a primary border plus the focus ring. |
| **Dropdowns** | A trigger pill with a chevron, and an absolutely positioned panel anchored at `inset-inline-start`. They close on outside click (`useCloseOnOutsideClick`) and animate with the `popover` preset. They use `role="listbox"` / `role="option"` with `aria-selected`. |
| **Cards** | Every card-like block shares one surface: white, 1px border, `--radius-lg`, `--shadow-sm`. |
| **Collapsible tool card** | `ToolCard` in `AdvancedTools.jsx`. Starts collapsed and keeps its title visible. The body animates with the CSS `grid-template-rows: 1fr → 0fr` technique (no height measuring). The toggle has `aria-expanded`, `aria-controls` and a translated `aria-label`. |
| **Modal** | `PersonModal`. `role="dialog"`, `aria-modal`, `aria-labelledby`. Escape or a backdrop click closes it, and the first useful control gets focus. The view mode lists only known fields. The form uses a 2-column grid (1 column under 700px). |
| **Toasts** | Bottom inline-end corner, `role="status"` with `aria-live="polite"`. Success toasts auto-dismiss after 4.5s; error toasts stay until closed. Use `showToast(kind, message)` in `App.jsx`. Messages come from `describeError()`, never raw JSON. |
| **Birthday chips and rows** | `PersonButton`. The pill (`.birthday-chip`) or row variant uses accent-tinted borders. The accent colour means "celebration": don't reuse it for generic emphasis. |
| **Tree cards (d3)** | 258 × 78px, radius 14px, avatar on the inline-start side, name in weight 600, lifespan in muted text. Deceased people get the muted card plus the olive-branch mark. A birthday today adds an accent dot. Families are spaced by their real width, so couples never overlap neighbours. |
| **Icons** | Inline SVG from `icons.jsx`: 24px grid, 2px stroke, `currentColor`, decorative (`aria-hidden`) unless they carry meaning. **No emoji as icons.** Deceased people get the olive branch: culturally neutral, not a skull or a religious symbol. |

## 5. Motion

Motion uses [Motion for React](https://motion.dev) (`motion/react`, pinned at 13.4.2) for enter/exit and lists, and CSS transitions for hover, press and collapse.

| Preset (`motionPresets.js`) | What | Feel |
|---|---|---|
| `fade` | Modal backdrop | 220ms in, 150ms out |
| `dialog` | Modal card | Rises 16px and settles with a soft spring (bounce 0.18, about 320ms); exits in 150ms |
| `popover` | Dropdown panels | 6px drop and fade, 180ms in, 120ms out |
| `collapseOut` | Dismissed birthday panel | 200ms fade and lift |
| `staggerList` / `staggerItem` | Birthday chips and rows | 40ms stagger, 6px rise |
| `toast(direction)` | Toasts | Slide in from the inline end (spring); scale-fade out |

**CSS timing tokens:**

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 150ms | Hover and press feedback |
| `--duration-base` | 220ms | Toggles, chevrons |
| `--duration-slow` | 320ms | Card collapse, background change |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Shared easing |

**Rules:**
- Exits are faster than entrances.
- Animate `transform` and `opacity` only. Never animate `width`, `height` or `top`. Collapse uses grid rows.
- Motion carries meaning (appear, leave, expand). There are no decorative loops or attention-seeking pulses.
- No overshoot on informational UI. The soft spring is only for things that "arrive" (modal, toast).
- **Reduced motion is respected twice:** `<MotionConfig reducedMotion="user">` wraps the app (Motion drops transforms, keeps fades), and a `prefers-reduced-motion` media query cuts CSS transitions to 1ms.
- Wrap anything that unmounts in `<AnimatePresence>`, and give the child a stable `key`.

## 6. RTL and languages

- Every string lives in `i18n.js` with `ar`, `en` and `fr` entries. A missing key is a bug.
- Use **logical CSS properties** (`margin-inline-start`, `padding-inline`, `inset-inline-start`, `border-inline-start`, `text-align: start`). Don't add new `left`/`right` rules for layout.
- Grid and flex follow `dir` automatically, so don't reorder with `order:` per language.
- **Exceptions that stay left-to-right on purpose:**
  - **Tree SVG** (`direction: ltr`): card text is placed with `text-anchor`, which would otherwise mirror and overflow. Arabic names still shape correctly inside.
  - **2D/3D switch**: "2D" stays on the left in every language.
- Chevrons that mean "collapsed" rotate toward the inline end (−90° in LTR, +90° in RTL).
- Dates are shown as stored (`YYYY-MM-DD`). Native date inputs follow the OS locale.

## 7. Accessibility checklist

Run through this for any new UI:

- [ ] Text contrast is at least 4.5:1 and UI-element contrast at least 3:1. Use the tokens and check new pairs.
- [ ] Every input has an associated visible label.
- [ ] Icon-only buttons have a translated `aria-label` (and a `title`).
- [ ] Focus is visible (the global `:focus-visible` ring). Never remove outlines without replacing them.
- [ ] It works with the keyboard alone: Tab reaches it, Enter/Space activates it, Escape closes overlays.
- [ ] Toggles expose state (`aria-expanded`, `aria-pressed` or `aria-selected`).
- [ ] Status messages use the toast stack (live region), not `alert()`.
- [ ] It works in Arabic (RTL), English and French with the longest label: Arabic labels often run longer than English.
- [ ] It holds up under reduced motion: state changes still visible, no movement needed to understand them.

## 8. Adding UI: do and don't

**Do**
- Reuse the shared surfaces and button classes before writing new CSS.
- Add new colours as tokens first, with a contrast check, then use the token.
- Add strings to all three languages in `i18n.js`.
- Use a preset from `motionPresets.js`; add a new preset there rather than inline numbers.

**Don't**
- Use inline `style={{…}}` for visual design (layout variables like `--depth-level` and `--tree-bg` are fine).
- Use emoji as icons, or add an icon library for a handful of glyphs.
- Load fonts or scripts from a CDN (the app runs offline).
- Introduce a second primary button in the same area.

## 9. Known gaps

- **No dark mode yet.** Every colour is already a token, so dark mode is a `:root` override plus a contrast pass.
- **The 3D tree** (`renderThreeTree` in `Tree.jsx`) still uses hard-coded `three.js` hex colours for its materials. They should be read from the tokens with `getComputedStyle`.
- **Electron tray menu and OS notifications** are English-only (`electron.js`).
- **`window.confirm()`** is still used for delete and import confirmations. A styled confirm dialog would match the rest of the UI.
- **Frame-rate measurements were inconclusive.** During automated browser testing the app page rendered at 1–3 fps, while other pages in the same browser ran at about 180. The original committed version showed the same, so it predates this design work, and JavaScript, the DOM and the styles were all ruled out as causes. Check animation smoothness in the real Electron window.
