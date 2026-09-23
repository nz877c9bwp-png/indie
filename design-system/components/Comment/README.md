A comment card and its replies under a post.

## Structure
`.comment-list` (a `<ul>`, `space-3` between items) → `.comment-item` (`panel`, `radius-lg`, `shadow-sm`, padding `space-4` `space-5`, `space-2` between rows):
- `.ci-meta` — `.ci-author` (13px/700 `text`, with an optional `.ci-op-badge` 글쓴이 label inside), an optional `.ip-tag`, then `.ci-date` (`meta`, 12px/500 `muted`, tabular). A `muted` middle dot sets the date apart and is hidden from assistive tech.
- `.ci-content` — `body-sm` (14px/1.6) in `text`, `pre-wrap`, breaking between words (`word-break: keep-all; overflow-wrap: anywhere`).
- `.ci-actions` — bare text buttons (답글, 신고) in `caption` type (12px/700) `muted`, `space-3` apart; hover turns them `text` and underlined.

## Replies
- A reply is `.comment-item.reply`: a real `panel` card on the quieter `shadow-xs` (not an inset well), hung off a 2px `muted-2` thread elbow drawn behind both cards.
- Set its indent inline as `margin-left` = 2 × `--elbow`. The default `--elbow` is 12px (a 24px indent); the app's 18px-per-level step sets `--elbow: 9px`. Drop any '↳' prefix where the elbow is drawn.

## Consumer supplies
Author, date (09.23 14:02), body text, the optional 글쓴이 flag and IP octets, and the reply depth.

## Rules
Same `radius-lg` and `space-5` inset as the review card, so text in one column starts on one x. The date reads 5.9:1 light / 5.6:1 dark on `panel`.
