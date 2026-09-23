Small inline labels beside titles and names: post category, notice, team, admin, 글쓴이, HOT and IP.

## When to use
Use a label to describe, never to act. Every label is 20px tall with `radius-xs` (6px) corners and `badge` type (12px/700, padding 0 `space-2`), so it never looks like a pressable pill. A label carries no outer margin toward what follows; the context sets the gap (in the post list, `.col-title > .notice-badge` adds `space-2` before the title).

## Variants
- `.tag` — post category (말머리, e.g. 잡담): `panel` fill, `text-2` label, 1px `line` inner ring so it keeps an edge on `bg`.
- `.notice-badge` — 공지: `music` fill with `on-accent` (4.67:1 light / 4.90:1 dark). Not the gradient: a label never borrows the button recipe.
- `.team-badge` — baseball team beside a nickname: set `background` to the team colour; the text is `--team-ink`, falling back to `on-accent`.
- `.admin-post-badge` — 관리자: `admin` fill with `on-accent`, `space-1` after the name. Render it only from the server's `is_admin_author` flag, never from a nickname.
- `.ci-op-badge` — 글쓴이 in comments: `accent-soft` fill with `accent-ink` (6.1:1 in both themes), `space-2` after the name.
- `.hot-badge` — HOT on widget cards: an eyebrow, not a label. `eyebrow` type (12px/800, +0.04em) in `accent-ink`, led by the logo's three bars (`--eq-mask`, 15×12), no fill.
- `.ip-tag` — first two IP octets beside guest names, e.g. (118.235): `meta` type (12px/500) in `muted`, tabular, `space-1` after the name.

## Consumer supplies
The text only, plus the team colour for `.team-badge` and, where white on it falls under 4.5:1, a `--team-ink` (한화 `#FF6600` takes `#191919`).

## Don't
- Don't make a label a pill, give it a shadow or put gradient in it.
- Don't use violet for anything but community highlights (HOT, 글쓴이), or the `music` fill for any label but 공지.
