# Badge

Small inline labels next to titles and names: board tag, notice, team, admin, HOT, IP.

Copied from `style.css` (`.tag`, `.notice-badge`, `.team-badge`, `.admin-post-badge`, `.hot-badge`, `.ip-tag`).

## Variants
- `.tag` — post category (말머리): pill, `panel-alt` fill, `muted` 11px/700.
- `.notice-badge` — 공지: gradient fill, white 11px/800, radius 10px.
- `.team-badge` — baseball team next to a nickname; the consumer sets `background` to the team colour (KBO team hexes live in `app.js`).
- `.admin-post-badge` — 관리자: `admin` fill, 10px/800. Rendered only from the server's `is_admin_author` flag, never from a nickname.
- `.hot-badge` — HOT on widget cards: gradient text, 12px/800.
- `.ip-tag` — first two IP octets beside guest posts, `muted-2` 11px.

## Consumer supplies
Text only (and the team colour for `.team-badge`).
