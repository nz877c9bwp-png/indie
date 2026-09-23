# Field

Inputs are wells pressed into the page: `bg` fill, no border, `shadow-inset-sm`.

From `style.css`: `.search` is copied; `.field` and `.field-area` consolidate the repeated rules on `.write-row input`, `.settings-row input`, `.modal-content input` and `#postContent`.

## Variants
- `.search` — header search pill (max 420px): inset pill with a flat `panel` button inside. The inner button has no shadow, because the pill's `overflow:hidden` would clip it.
- `.field` — single-line input or select: padding 12px 14px, `radius-sm`, 14px.
- `.field-area` — the post editor: 18px padding, `radius`, 15px/1.6, deeper `shadow-inset`.

## Rules
- No borders anywhere; depth comes from the inset shadow.
- Autofill is repainted to `bg` so the browser's blue does not break the look.
- Placeholder in `muted`. Focus: 2px `music` outline.
