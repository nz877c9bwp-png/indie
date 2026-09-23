# Tabs

Pill tabs and sort links for switching a list's filter.

Copied from `style.css` (`.team-tab-btn`, `.rec-service-tab`, `.sort-btns`). `.team-tabs` is a wrapper name used here for `#baseballTeamTabs` / `#albumReleaseTabs`.

## Variants
- `.team-tab-btn` — 13px/700 pills, raised with `shadow-sm`. Active: filled with `--team-color` (set inline per team) or `accent-gradient`, white text, `shadow-inset-sm`. Also used for album release type (싱글 / EP / 정규).
- `.rec-service-tab` — smaller 12px pills for picking a player (YouTube / YouTube Music / Apple Music). Active: gradient TEXT on `panel` with `shadow-inset-sm`.
- `.sort-btns` — bare text links (최신순 · 추천순 · 조회순); active is gradient text at 800.

## Rule
Selected = pressed in (inset shadow) + gradient. Unselected = raised + `muted`.
