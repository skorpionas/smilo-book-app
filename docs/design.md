# Smilo design direction

One owner, on her phone, between appointments, often with wet or busy hands. The UI should feel calm and
obvious: warm paper-like surfaces, one teal accent, big readable type, nothing that competes with the schedule.

Live reference: `/styleguide` (behind login, linked from **Nustatymai → Dizaino gidas**) renders every token and
component in light and dark side by side.

## Where it comes from

- **Claude web (claude.ai)** — the main quality bar. Borrowed: warm ivory page (`#faf9f5`) and warm charcoal dark
  mode instead of pure white / black; a serif for display moments and a clean sans for UI; hairline borders
  instead of shadows; generous whitespace; quiet sidebar where the active item is a slightly raised chip; restrained
  motion.
- **Paperclip** (paperclip.ing — the open-source AI-agent "company" dashboard; its repo ships a public design guide).
  Borrowed: semantic tokens only (never hard-coded light/dark values), one radius scale, minimal shadows (`xs`/`sm`
  for cards, heavy only for floating layers), shared status colours with icons, and a living showcase page that
  every new component must be added to. Not borrowed: its dense, keyboard-first, dark-by-default layout — Smilo is
  touch-first and light-by-default.

## Principles

1. **Schedule first.** Chrome (headers, nav) is translucent and quiet; content gets the contrast.
2. **One accent.** Teal (`--primary`) marks the primary action, the active tab and focus. Everything else is
   warm neutral. Groomer colours and statuses are the only other colours.
3. **Thumb zone.** Primary actions sit at the bottom on phones (bottom nav, sheet footers, future FAB). Every target
   ≥ 44 × 44 px; inputs 16 px so iOS never zooms.
4. **Never colour alone.** Statuses are icon + word + tint. Groomers are name + dot + stripe.
5. **Calm motion.** Short, decelerating, no bounce; off when the OS asks for reduced motion.
6. **Every empty, loading and error state is designed.** Empty states explain what will appear and how; loading
   shows skeletons in the final layout; errors say what happened in plain Lithuanian.

## Colour

All values in `app/globals.css`. Light is the default; dark follows `prefers-color-scheme` (and `data-theme` for
the style guide). All text pairs are ≥ 4.5:1, input borders and the focus ring ≥ 3:1 (checked with a script).

| Token                                      | Light                 | Dark                   | Use                                   |
| ------------------------------------------ | --------------------- | ---------------------- | ------------------------------------- |
| `--background`                             | `#faf9f5`             | `#21201e`              | page                                  |
| `--surface`                                | `#ffffff`             | `#2a2926`              | cards, inputs, sheets, tab bar        |
| `--surface-muted`                          | `#f2f0e9`             | `#33322e`              | hover fills, skeletons                |
| `--sidebar`                                | `#f4f2ec`             | `#1b1a18`              | desktop sidebar                       |
| `--foreground`                             | `#1f1e1c`             | `#f3f1ea`              | text (15.8:1 / 14.4:1)                |
| `--foreground-soft`                        | `#45433e`             | `#d6d3ca`              | secondary text                        |
| `--muted`                                  | `#67645c`             | `#a8a59b`              | meta text, icons (≥ 5.2:1 everywhere) |
| `--border`                                 | `#e6e3da`             | `#383733`              | decorative hairlines                  |
| `--input`                                  | `#8d897f`             | `#7a766d`              | form control borders (≥ 3.2:1)        |
| `--primary`                                | `#0f766e`             | `#5bbfb1`              | the accent (app icon teal)            |
| `--primary-soft` / `-fg`                   | `#e2f0ec` / `#0b5a53` | `#1d3734` / `#8fd8cc`  | active tab, success alert             |
| `--danger` / `--danger-soft`               | `#b42318` / `#fbece9` | `#f2877a` / `#3d2420`  | destructive, errors                   |
| status: info / success / warning / neutral | soft tint + dark text | dark tint + light text | badges                                |

**Groomer colours** come from `groomers.color` and can be anything. They are never used for text: only a dot, a
2 px stripe under the column header and a 16 % tint (`color-mix(in oklab, <colour> 16%, var(--surface))`) behind
normal foreground text — legible on both themes whatever the owner picks (the style guide shows six extremes,
including yellow and near-black).

**Booking statuses** (`StatusBadge`): Suplanuota = info + calendar-clock, Įvykdyta = success + check, Atšaukta =
neutral + ban, Neatvyko = warning + user-x.

## Type

Self-hosted variable fonts in `app/fonts/` (SIL OFL), Latin + Latin Extended subsets only (all Lithuanian letters),
no requests to Google. ~130 KB of fonts in total, cached; zero JS.

- **Inter** — UI. `cv11`/`ss01` for a friendlier single-storey a and open digits; `tabular-nums` for times/prices.
- **Source Serif 4** — display only: brand wordmark, page titles, empty-state and sheet titles, the calendar date.

| Role              | Style                                                       |
| ----------------- | ----------------------------------------------------------- |
| Display           | serif 30 px / semibold / tight (login wordmark)             |
| Page title (h1)   | serif 22 px / semibold                                      |
| Section / card    | sans 16 px / semibold                                       |
| Body              | sans 16 px / 1.5–1.6 (phone-first, never below 16 in forms) |
| Meta              | sans 14 px, `--muted`                                       |
| Small / tab label | sans 12 px (overline labels uppercase + tracking)           |

## Space, radius, elevation

- Spacing: Tailwind 4 px scale. Page gutters 16 px (phone) / 24 px; card padding 16 / 20 px; form fields 20 px
  apart; sections 32 px apart. Reading pages are centred at max 64 rem; the calendar is full width.
- Radius: `sm` 6 px (chips inside controls), `md` 10 px (buttons, inputs, alerts), `lg` 14 px (cards, toasts),
  `xl` 20 px (sheets, dialogs, login card). Pills/avatars `full`.
- Elevation: borders first. `shadow-xs` on buttons/inputs/cards, `shadow-sm` on the login card, `shadow-lg` only for
  floating layers (sheet, dialog, toast). Dark mode relies on lighter surfaces, not shadows.
- Focus: one style everywhere — 2 px `--ring` outline with 2 px offset; inputs add a soft 3 px ring.

## Motion

| What                        | Duration                     | Easing                       |
| --------------------------- | ---------------------------- | ---------------------------- |
| hover / colour              | 150 ms                       | ease-out                     |
| press                       | scale 0.98, motion-safe only |                              |
| enter (fade, toast, dialog) | 180–220 ms                   | `cubic-bezier(0.2, 0, 0, 1)` |
| sheet in                    | 260 ms                       | same; out 180 ms ease-in     |
| skeleton pulse              | 1.6 s                        | ease-in-out                  |

`prefers-reduced-motion: reduce` collapses every animation and transition to 1 ms (state changes stay instant).

## Components (`components/ui/`)

| Component                                                                  | Notes                                                                                                                         |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                                   | primary · secondary · soft · ghost · danger · link; sm/md/lg/icon (all ≥ 44 px); `loading` = spinner, `aria-busy`, width kept |
| `Input`, `Textarea`, `Select` (native), `Label`, `FieldHint`, `FieldError` | 16 px text, `aria-invalid` styling, error has icon + `role="alert"`                                                           |
| `PasswordInput`                                                            | show / hide toggle (`aria-pressed`)                                                                                           |
| `Card` (+ Header/Title/Description/Content/Footer)                         | hairline border, `shadow-xs`                                                                                                  |
| `Badge`, `StatusBadge`                                                     | tones; status = icon + word + tint                                                                                            |
| `Alert`                                                                    | info / success / danger inline messages                                                                                       |
| `Sheet` (+ Header/Title/Description/Body/Footer)                           | Radix Dialog; bottom sheet < 1024 px with grab handle, right panel ≥ 1024 px; sticky footer in the thumb zone                 |
| `Dialog`                                                                   | short confirmations; destructive action on the right/bottom                                                                   |
| `Toast` / `toast()`                                                        | Radix Toast; above the tab bar on phones, bottom-right on laptops; swipe down to dismiss; errors announced assertively        |
| `Skeleton`, `Spinner`                                                      | calm pulse; static under reduced motion                                                                                       |
| `EmptyState`                                                               | icon in a soft circle, serif title, one sentence, optional action                                                             |
| `Avatar`                                                                   | initials (Lithuanian-aware upper-casing) or icon; deterministic warm tint                                                     |
| `GroomerDot`, `GroomerChip`                                                | DB colour as dot + tint, name always visible                                                                                  |

App-level: `PageHeader` (sticky, translucent, safe-area aware, optional eyebrow, `wide` for the calendar),
`PageBody`, `BottomNav` (active = soft pill behind the icon + bold label), `SideNav`.

## Week 2 guidance

- Day grid: 15-min rows at ~16 px (4 rem per hour, as previewed), booking blocks = surface card with a 3 px left
  stripe in the groomer colour + 16 % tint, time in `tabular-nums`, pet names bold, status icon top-right.
  Cancelled are hidden; no-show keeps the block with the warning badge. "Now" line in `--danger`.
- Booking form: `Sheet`, fields stacked, save button in `SheetFooter`; overlap error = `Alert tone="danger"` at the
  top of the sheet and a `toast` on success.
- FAB "+": `Button size="icon"` 56 px round, bottom-right above the tab bar on phones only.
