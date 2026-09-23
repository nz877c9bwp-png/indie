The DULI.KR header lockup: a gradient logo badge holding the three-bar mark, followed by the "Do U Like Indie.KR" wordmark.

## When to use
Once per screen, top-left of the sticky header, in its 232px first column. It is also the home link (`changeBoard('전체')`).

## Anatomy
- `.brand` — `brand` type (22px/1.2), a flex row with `space-3` (12px) between badge and word; carries `.display`.
- `.logo-badge` — 40×40, `radius-sm`, `accent-gradient` fill, `accent-glow`. Inside: the bar mark SVG (see Logos) at 26×26, bars in `on-accent` white (`#fff` and `rgba(255,255,255,0.6)`).
- `.brand-word` — one `music-mark` → `accent-mark` sweep (100deg) clipped to the text across the whole word. Each word is a `.bw-group`; the four capitals D·U·L·I stand on one even pitch: each `.bw-slot` is a fixed 1.5em column (`--bw-pitch`), wide enough for its widest content (I + ndie), and `.KR` follows in the same sweep at capital size. Tails (`.bw-small`) are 10px/400 in `text-2`, tucked after their capital.
  - `.bw-big` — the capitals D U L I at 1.15em/900, -0.8px, in the sweep.
  - `.bw-small` — the tails (o, ike, ndie) at 13px/600 in `text-2`, set tight against their capital.
  - `.bw-big.bw-kr` — `.KR` at 1em/700 in `text-2`, pulled against "Indie" like a domain.
- It reads D·o U L·ike I·ndie.KR in two inks: the sweep and `text-2`. `.bw-slot` stays in the markup and takes natural width.

## Contrast
On the header, the sweep runs from `music-mark` (4.5:1) to `accent-mark` (5.5:1 light / 5.0:1 dark) on 25px/900 capitals; the tails and `.KR` in `text-2` read 7.5:1 / 8.1:1. In forced-colours mode the whole wordmark paints `CanvasText`.

## Do / Don't
- Do keep the badge-to-word gap at `space-3` (12px).
- Don't add a third ink or put the tails in the sweep.
- Don't place the white bar mark on anything but the gradient badge: it is white ink.
