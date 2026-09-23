The left sidebar that lists boards by category and marks the current one.

## When to use
Once per page, in the 232px first column of `.shell`. It is the board navigation on desktop.

## Structure
`.sidebar` (`panel`, `radius-lg`, `shadow-sm`, padding `space-2` with `space-3` at the bottom) → optional `.cat-group` → `.cat-head` + `.board-list`.
- `.cat-head` — group name in `caption` type (12px/700) `muted`, padding `space-3` `space-3` `space-1`, so it hugs its own links.
- `.board-list` — a `<ul>` of `li > a`: 36px rows `space-1` apart, padding 0 `space-3`, 16px corners (`radius-lg` − `space-2`, concentric with the panel), 14px/500 in `text-2`.
- Groups sit `space-4` apart, with or without a `.cat-group` wrapper.

## Consumer supplies
Group names (커뮤니티, 공연, 자유), board names (인디 게시판, 추천곡, 앨범 평가, 공연 정보, 공연 후기), and the `.active` class on the current board's link.

## States
- Hover: `panel-alt` fill, `text` label.
- Active: `music-soft` fill, 1px `music-line` inner edge, `music-ink` label at 800 (5.35:1 light / 5.8:1 dark). No gradient text, no pressed well.
- Focus: 2px `focus` ring at 2px offset, raised above the neighbouring rows so it is never clipped.

## Responsive
Under 840px the site turns the sidebar into a slide-in drawer behind the header's hamburger, over a 45% black, 6px-blur backdrop. The bundle does not carry the drawer.
