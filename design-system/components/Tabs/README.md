Three filter idioms for a list, each with its own single "on": genre chips, the service segmented control, and sort links.

## Variants
- `.team-tabs` > `.team-tab-btn` — chips for genre or album release type (전체 / 싱글 / EP / 정규) and for baseball teams. 36px pills, padding 0 `space-4`, `panel` + `shadow-xs`, `text-2` at 14px/600; `space-2` apart, `space-4` below the row.
  - Hover: `panel-alt`, `text`.
  - Selected (`.active`): `music-soft` fill, 1px `music-line` inner edge, `music-ink` at 800, flat (no drop). No gradient fill.
  - Team-coloured (`style="--team-color:…"`): the selected chip fills with `--team-color`, takes `shadow-fill`, and sets its text in `--team-ink`, falling back to `on-accent`. Pass `--team-ink` whenever white on the team colour is under 4.5:1 (한화 `#FF6600` needs `#191919`).
- `.rec-service-tabs` > `.rec-service-tab` — a segmented control for picking the player (YouTube / YouTube Music / Apple Music): one `field` well (`radius-pill`, `space-1` inset and gap, `shadow-inset-sm`) holding 32px flat tabs, 13px/600 in `text-2`.
  - Hover: `text`.
  - Selected: a raised `panel` thumb with `shadow-xs`, `text` at 800. It stays neutral: the raised shape is the state, and blue belongs to the chips.
  - Focus: the ring is drawn 2px inside the tab (`outline-offset: -2px`).
- `.sort-btns` — bare text links (최신순 · 추천순 · 조회순), `space-4` apart, 14px/600 in `muted`, on the board title's baseline in `.board-title-row`.
  - Hover: `text` with a 2px `muted-2` underline.
  - Selected: `text` at 800 with a 2px `music-mark` underline at a 7px offset.
  - Focus: the ring sits at a 4px offset, clear of the underline.

## Consumer supplies
The labels and the `.active` class on the current option; for teams, `--team-color` (and `--team-ink` when needed) set inline from `app.js`.

## Rule
Keep one "on" per idiom and don't mix them: chips go blue, the segmented control raises a neutral thumb, sort underlines. Selected never uses gradient text, and hover never borrows the selected colour.
