# Brand

The DULI.KR header lockup: a gradient logo badge holding three white rounded bars, followed by the "Do U Like Indie .KR" wordmark.

Hand-written from `index.html` (`.brand`) and `style.css`.

## When to use
Once per screen, top-left of the sticky header. It is also the home link (`changeBoard('전체')`).

## Anatomy
- `.logo-badge` — 38×38, `radius-sm`, `accent-gradient` fill, `accent-glow` shadow. Inside: the bar mark SVG (see Logos), 26×26, bars at `#fff` and `rgba(255,255,255,0.6)`.
- `.brand-word` — each word is a `.bw-group`: a capital (`.bw-big`, 1.15em, weight 900, gradient text) plus its tail in `.bw-small` (10px, weight 300, `muted`). `.bw-slot` fixes each capital column at 21.14px so the capitals line up as D U L I. `.KR` uses `muted`.

## Do / Don't
- Do keep the gap between badge and word at 28px.
- Don't place the white bar mark on anything but the gradient badge — it is white ink.
