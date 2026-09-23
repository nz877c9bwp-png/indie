Page buttons under the post table.

## Structure
`.pagination` (flex, `space-1` gap) holding `.page-btn` buttons: 36px circles (`radius-pill`, min-width 36px, padding 0 `space-3`), no fill at rest, `text-2` at 14px/600, tabular. The first and last buttons (‹ ›) are 20px/500 so the arrows carry the weight of the numbers.

## Consumer supplies
‹, the page numbers, ›; `.active` on the current page and `disabled` on an arrow with nowhere to go.

## States
- Hover: rises to a `panel` key with `shadow-xs`, label `text`.
- Current (`.active`): `music-soft` fill, 1px `music-line` inner edge, `music-ink` at 800, the shared selected recipe. No gradient text, no pressed well.
- Disabled: `disabled-opacity` (0.4), no fill, no shadow, default cursor.
- Focus: 2px `focus` ring at 2px offset.
