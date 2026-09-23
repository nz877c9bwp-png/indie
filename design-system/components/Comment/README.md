# Comment

A comment and its replies under a post.

Copied from `style.css` (`.comment-item`, `.ci-*`).

## Structure
`.comment-item` (`panel`, `radius`, `shadow-sm`, padding 14px 16px) → `.ci-meta` (author bold, optional 글쓴이 badge `.ci-op-badge` in gradient text, date 12px `muted`) → `.ci-content` (14px/1.5, pre-wrap) → `.ci-actions` (12px bold `muted` text buttons).

## Replies
A reply (`.reply`) is pressed in with `shadow-inset-sm` instead of raised; its indent is set inline from the reply depth.
