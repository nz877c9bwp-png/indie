# BoardNav

The left sidebar listing boards by category.

Copied from `style.css` (`.sidebar`, `.cat-head`, `.board-list`).

## Structure
`.sidebar` (230px wide in the desktop grid, `panel`, `radius-lg`, `shadow-sm`, 6px padding) → `.cat-group` → `.cat-head` (12.5px/700 `muted`) + `.board-list` of links (13px `muted`, `radius-sm`). The active board is pressed in (`shadow-inset-sm`) with gradient text at 700.

## Responsive
Under 840px the sidebar becomes a slide-in drawer opened by the header's hamburger, over a 45% black, 6px-blur backdrop.
