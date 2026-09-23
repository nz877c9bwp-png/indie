Buttons come in three weights (gradient primary, raised secondary, red danger), plus ghost text actions and vendor sign-in keys; every one is a pill.

## When to use
One primary per view: `.write-btn` in the header, `.btn-submit-write` at the foot of a form. Everything else is secondary, danger or ghost.

## Variants
The six action buttons share a 40px `radius-pill`, padding 0 `space-5`, `control` type (14px/700) and `space-2` between an icon glyph and the label, except where the table says otherwise.

| Class | Use | Look |
|---|---|---|
| `.write-btn` | The header CTA (글쓰기) | `accent-gradient`, `on-accent` label, `accent-glow`; `space-2` after the auth links in `.user-actions` |
| `.btn-submit-write` | Submit a form (등록) | The one large step: 44px (the height of the fields it submits), 15px/800, padding 0 `space-8`; same fill and glow |
| `.btn-list` | Secondary (목록, 취소) | `panel` + `shadow-xs`, `text` label |
| `.btn-recommend` | Recommend (♥ 추천 12) | `panel` + `shadow-xs`, `music-ink` label at 800, tabular count, padding 0 `space-6` |
| `.btn-admin-delete` | Destructive (삭제) | `admin` fill, `on-accent` label, `shadow-fill` |
| `.btn-settings-danger` | Destructive, quiet (회원 탈퇴) | Transparent, `admin-ink` label and 1px `admin-ink` inner ring |
| `.auth-btn` | Header text actions (로그인, 회원가입) | 36px ghost pill, padding 0 `space-3`, `text-2` at 14px/600, no chrome |
| `.kakao-btn`, `.apple-btn` | Social sign-in | Full-width 48px pills, 15px/700, `shadow-fill`. Kakao `#FEE500` with `#191919`; Apple `apple-fill` with `apple-ink`; `.apple-btn` sits `space-2` below Kakao |

## States
- **Hover darkens, never brightens.** Gradient buttons swap to `linear-gradient(135deg, music-hover 10%, accent-hover)` and lift 1px. `.btn-admin-delete` goes to `admin-hover`. `.btn-settings-danger` fills with `admin` and turns its label `on-accent`. `.btn-list` steps to `panel-alt`; `.auth-btn` to `panel-alt` with a `text` label; `.btn-recommend` to `music-soft`. Kakao and Apple take `brightness(.97)`.
- **Pressed:** gradient and delete buttons keep their hover fill, drop the lift and sink to `shadow-inset`; `.btn-list`, `.btn-recommend`, Kakao and Apple sink to `shadow-inset-sm`.
- **Focus:** 2px `focus` outline at 2px offset.
- **Disabled:** `disabled-opacity` (0.4), no shadow.
- No state uses gradient text.

## Consumer supplies
A short Korean label, a verb or noun: 글쓰기, 등록, 목록, 삭제. Put ♥ before the recommend count.

## Contrast
`on-accent` white reads at least 4.67:1 on every resting fill in both themes (the gradient's `music` stop 4.67 light / 4.90 dark, `admin` 5.75 / 4.69) and at least 5.85:1 on every hover fill. `admin-ink` reads at least 4.8:1 light / 4.7:1 dark on `bg`, `panel`, `panel-alt` and `field`; `music-ink` 6.7:1 on `panel` and 5.35 / 5.8 on the `music-soft` hover. Kakao reads 13.8:1, Apple 21:1.
