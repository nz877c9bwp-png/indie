# Button

Buttons come in three weights: gradient primary, neumorphic secondary, and red danger. Text-only links sit beside them.

Copied from `style.css` (`.write-btn`, `.btn-submit-write`, `.btn-list`, `.btn-recommend`, `.btn-admin-delete`, `.btn-settings-danger`, `.auth-btn`, `.kakao-btn`, `.apple-btn`).

## Variants
| Class | Use | Look |
|---|---|---|
| `.write-btn` | The one header CTA (글쓰기) | pill (999px), `accent-gradient`, white 13px/700, `accent-glow` |
| `.btn-submit-write` | Submit in forms (등록) | `radius-sm`, gradient, 14px bold, padding 11px 34px |
| `.btn-list` | Secondary (목록, 취소) | `panel` + `shadow-sm`, `text`; hover turns the label to gradient text |
| `.btn-recommend` | Like/recommend | pill, `panel`, gradient label, `shadow-sm` |
| `.btn-admin-delete` | Destructive | `admin` fill, white |
| `.btn-settings-danger` | Destructive, quiet | 1px `admin` outline; fills on hover |
| `.auth-btn` | Header text actions | no chrome; gradient text on hover |
| `.kakao-btn`, `.apple-btn` | Social sign-in | vendor colours (#FEE500 on #191919; black, white in dark) |

## States
Hover on gradient fills: `filter: brightness(1.08)`. Pressed: `shadow-inset` (the button sinks into the surface). Focus: 2px `music` outline, 2px offset.

## Consumer supplies
The label (Korean, short, a verb or noun: 글쓰기, 등록, 목록). One primary per view.

## Contrast note
White 13–14px text on the gradient starts at 3.7:1 on `music` (light) and 3.1:1 (dark) — below 4.5:1. The source is kept as is; prefer weight 700 and avoid long labels on gradient.
