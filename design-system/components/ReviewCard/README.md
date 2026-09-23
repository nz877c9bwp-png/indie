An album review in the album-rating board's review list.

## When to use
In the column of reviews under an album; the whole card opens the review.

## Structure
`.review-card` (`panel`, `radius-lg`, `shadow-sm`, padding `space-5`):
- `.rc-header` — `.rc-author` (13px/700 `text-2`) on the left; `.rc-stars` on the right, ★/☆ plus the score in `accent-ink` at 13px/800 with 1px tracking, tabular. `space-2` below.
- `.rc-title` — `card-title` (17px/1.45/800) in `text`, `space-2` below.
- `.rc-content` — the excerpt at 14px/1.7 in `text-2`, clamped to 3 lines, breaking between words.

## Consumer supplies
Author, rating (★★★★☆ 4.0), title and body excerpt. For keyboard access add `tabindex="0"` and Enter/Space handlers; the bundle already draws the focus ring.

## States
Hover lifts 2px and deepens to `shadow-md`. Ratings are violet text, never gradient.

## Rules
Same `radius-lg` and `space-5` inset as comments, so text in the column starts on one x.
