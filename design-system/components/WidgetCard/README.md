# WidgetCard

HOT post card shown in a fixed four-column grid above the board.

Copied from `style.css` (`.widget-card`, `.hot-badge`, `.widget-title`, `.widget-stats`).

## Consumer supplies
A title (clamped to two lines), and stats (views, likes, comments) as 12px `muted` text. Clicking opens the post.

## Rules
- Always four columns (`repeat(4, 1fr)`, gap 16px) so four cards never wrap as 3 + 1.
- Hover lifts 3px; the shadow stays `shadow-sm`.
