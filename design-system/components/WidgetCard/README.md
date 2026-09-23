HOT post card, shown four across above the board.

## When to use
Only in `.widget-container` at the top of a board, for HOT posts.

## Structure
`.widget-card` (`panel`, `radius-lg`, `shadow-sm`, padding `space-5`, a flex column):
- `.hot-badge` — the HOT eyebrow (`accent-ink`, led by the three bars), `space-3` above the title.
- `.widget-title` — `list-title` (16px/1.45/700) in `text`, clamped to two lines, breaking between words, `space-4` above the stats.
- `.widget-stats` — `meta` (12px/500) in `muted`, tabular, `space-3` apart, pinned to the bottom of the card.

## Consumer supplies
A title and the stats as short Korean text (조회 1,204 · 추천 38). The whole card opens the post; for keyboard access add `tabindex="0"` and Enter/Space handlers.

## Rules
- Always four columns: `.widget-container` is `repeat(4, minmax(0, 1fr))` with a `space-4` gap and `space-10` below, so four cards never wrap as 3 + 1.
- Hover lifts 2px and deepens to `shadow-md`.
