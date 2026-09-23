Inputs are gentle wells on `field`: no border, an inset shadow with a 1px rim, text in `text`.

## When to use
`.search` for the header and board search; `.field` for any single-line input or select; `.field-area` for the post editor.

## Variants
- `.search` — the search bar: a `field` pill (`radius-pill`, 44px, `width: 100%` up to 440px, padding `space-1`, `shadow-inset-sm`) with a 16px magnifier (`--search-mask` in `muted`) on the left, a 14px input, and a raised 검색 key (36px `panel` pill, `control-sm` 13px/700 `text`, `shadow-xs`). In the header (`.header-inner > .search`) it is 40px tall and up to 520px wide, with a 32px key. The field and its key read as one control, which is why the bar is a pill.
- `.field` — single-line input or select: 44px, padding 0 `space-4`, `radius-sm`, 14px, `shadow-inset-sm`.
- `.field-area` — the post editor: full width, padding `space-3` `space-4`, `radius-sm`, 15px/1.7, vertical resize, the deeper `shadow-inset`. Its corner and placeholder x match `.field`, so a stacked form lines up.

## States
- Placeholder in `muted` (5.0:1 light / 7.0:1 dark on `field`).
- Focus: 2px `focus` outline at 2px offset. The search pill takes the ring while its input is focused (the input drops its own ring only where `:has()` is supported); a focused 검색 key rings itself at offset 0, inside the pill.
- 검색 key: hover turns the label `music-ink`; pressed sinks to `shadow-inset-sm`.

## Consumer supplies
A placeholder that describes the field (게시글 검색, 제목을 입력하세요, 내용을 입력하세요, 작성자), the width of `.field` and the height of `.field-area`.

## Rules
- No borders; depth comes from the inset shadow and its rim.
- Fields you fill in take `radius-sm`; only the search bar is a pill.
- Repaint browser autofill to `field` and `text` so the browser's blue does not break the well.
