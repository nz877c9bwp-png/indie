DULI.KR ("너 인디 좋아해?", *Do U Like Indie*) is a Korean indie-music community board: posts, recommended songs, album ratings, gig news and reviews. The interface is **soft and tactile**: near-white panels float one step above a cool-grey page (a soft charcoal in dark), inputs sit in gentle inset wells, and colour has three jobs only: the **blue-to-violet gradient** for brand fills, **blue** for what is selected, **violet** for community highlights.

## Content fundamentals

- **Language:** Korean, casual and short. Speak to the reader in 반말, the way the brand name does: 너 인디 좋아해?
- **Labels are nouns or bare verbs:** 글쓰기, 등록, 목록, 검색, 로그인, 회원가입, 마이페이지, 답글, 신고. No trailing punctuation, no "하기" padding.
- **Board and category names** stay plain: 인디 게시판, 추천곡, 앨범 평가, 공연 정보, 공연 후기.
- **Placeholders** describe the field: 게시글 검색, 제목을 입력하세요.
- **Status words** go in badges, not sentences: 공지, HOT, 관리자, 글쓴이.
- **No emoji** as decoration. Symbols appear only where they carry data: ★ for ratings, ♥ for recommend counts, [n] for comment counts.
- **Numbers** (views, likes, dates, durations, track numbers) use `font-variant-numeric: tabular-nums` (`.tabular`).

## Visual foundations

### Surfaces and depth
- Set the page on `bg` and every surface on `panel`, one step lighter (light `#fbfcfd` on `#edf0f4`; dark `#2b2f36` on `#22252b`). Always pair `panel` with a shadow token.
- **Raised containers** = `panel` + `shadow-sm`: `.sidebar`, `.widget-card`, `.review-card`, `.comment-item`, the track trays. Clickable cards lift on hover: `translateY(-2px)` and `shadow-md`.
- **Small raised controls** = `panel` + `shadow-xs`: `.btn-list`, `.btn-recommend`, idle `.team-tab-btn`, the 검색 key, the segmented-control thumb, `.page-btn:hover`, the reply comment.
- **Wells** = `field` + `shadow-inset-sm`: `.search`, `.field`, `.rec-service-tabs`. The post editor `.field-area` takes the deeper `shadow-inset`. Both inset shadows carry a 1px rim (13% navy in light, 5% white in dark) so a well keeps its edge and never reads as a disabled slab.
- **Pressed:** filled buttons sink to `shadow-inset` on `:active`; raised keys sink to `shadow-inset-sm`.
- `panel-alt` is the quiet hover fill on `panel` (rows, ghost buttons, chips, sidebar links, `.btn-list`) and the album-art placeholder. It never marks selection.
- **Brand fills** (`accent-gradient`) take `accent-glow`, a "lit key": a neutral drop plus a brighter 1px top highlight, never a coloured halo. Other solid fills (delete, Kakao, Apple, a team-coloured chip) take `shadow-fill`. Album art in lists takes `shadow-art`, a short record-sleeve drop; dark adds a 16% white rim so a dark sleeve keeps its edge.
- **No borders** on surfaces or controls. The few drawn lines are 1px inset box-shadows with one job each: the `line` ring on `.tag`, the `music-line` edge of a selected fill, the `admin-ink` ring on `.btn-settings-danger`. The only other strokes are the reply's 2px `muted-2` thread elbow and the sort underline.
- Shadows are single-direction light. In light they are navy-tinted (`sh-dark`, rgb(24, 39, 75)) with a white top highlight; in dark they are black with a faint white ring (6–10%) so edges read on charcoal. `sh-light` and `sh-dark` are reference inks, not variables: use the shadow tokens.
- The sticky header `.site-header` is `panel-glass` (`panel` at 88%) under `backdrop-filter: saturate(180%) blur(12px)`, with `shadow-header` (a hairline bottom edge plus a soft drop).

### Colour
- **Three jobs, never swapped.**
  - **Gradient = brand fills only:** `.logo-badge`, `.write-btn`, `.btn-submit-write`, always under `on-accent`. `accent-gradient` is `linear-gradient(135deg, music 10%, accent)`: `#1F6FE8` → `#7042EF` in light, `#2B6BE0` → `#7A4DF0` in dark. The wordmark is the only gradient text, on its own `music-mark` → `accent-mark` sweep. Never use gradient text for a state; the bundle ships no `.gradient-text` utility, so use `music-ink` or `accent-ink`.
  - **Blue = selection:** `music-soft` fill + 1px `music-line` inner edge + `music-ink` text at 800 (see Focus and states). Blue text also marks the recommend button and the 검색 key hover.
  - **Violet = community highlights:** HOT, 글쓴이, star ratings and the album score, in `accent-ink`, with `accent-soft` behind the 글쓴이 label. Violet never marks selection, and blue never marks a highlight.
- **Fill, ink, mark.** `music`, `accent` and `admin` are fills (`music` also fills the 공지 label and draws the light focus ring). Set text in `music-ink`, `accent-ink`, `admin-ink`. Draw non-text marks (sort underline, wordmark, cover) in `music-mark` / `accent-mark`. Put `on-accent` (`#ffffff` in both themes) on every fill. `special` is an alias of `music`: write `music`.
- **Hovers darken.** Filled buttons hover and press to `music-hover` → `accent-hover` (the gradient) or `admin-hover` (delete). Never brighten a fill with `filter`.
- `admin` red is danger and staff only: `admin` fills the delete button, the 관리자 badge and the danger-button hover; `admin-ink` is the text and outline of 회원 탈퇴, dislike, report hover and the list comment count.
- **Neutrals:** `text` for anything read first. `text-2` for secondary text read in full: sidebar links, idle chips and page numbers, review excerpt and author, auth links, `.tag`, the wordmark tails and `.KR`. `muted` for meta: dates, counts, sort links, group heads, track numbers and durations, artist line, placeholders, IP tag. `muted-2` for decoration only: the reply elbow, the sort hover underline, the scrollbar thumb. `line` is the `.tag` ring and nothing else.
- **Dark theme:** set `[data-theme="dark"]` on `<html>`; every per-theme value lives in the tokens. Dark is a soft charcoal, not near-black. `grain-opacity` is 0: components draw no grain.
- Third-party colours stay fixed: Kakao `#FEE500` with `#191919` in both themes; Apple `apple-fill` with `apple-ink` (black with white in light, white with black in dark). `cover-ink` and `cover-bar` belong to the cover card only.
- **Contrast** (light / dark), every pair checked in both themes:
  - `text` at least 13.2 / 10.3 on `bg`, `panel`, `panel-alt`, `field`; 12.4 / 10.2 on `music-soft`.
  - `text-2` at least 6.4 / 7.0 on `bg`, `panel`, `panel-alt`, `field`.
  - `muted` at least 5.0 / 4.8 on `bg`, `panel`, `panel-alt`, `field`; 4.7 / 4.8 on `music-soft`.
  - `music-ink` 5.35 / 5.8 on `music-soft`, 6.0 / 7.6 on `bg`, 6.7 / 6.7 on `panel`.
  - `accent-ink` at least 5.9 / 5.4 on `bg`, `panel`, `panel-alt`, `field`; 6.1 / 6.1 on `accent-soft`.
  - `admin-ink` at least 4.8 / 4.7 on `bg`, `panel`, `panel-alt`, `field`.
  - `on-accent` on resting fills: `music` 4.67 / 4.90, `accent` 5.65 / 5.06, `admin` 5.75 / 4.69. On hover fills at least 5.85: `music-hover` 5.85 / 5.85, `accent-hover` 7.09 / 6.21, `admin-hover` 7.07 / 5.96.
  - Marks (3:1 floor): `music-mark` at least 3.9 / 3.8 on `bg`, `panel`, `panel-alt`, `field`; the `focus` ring at least 3.6 / 5.8 on those grounds and on `music-soft`.
  - Below the floor on purpose, so never text and never a lone state cue: `muted-2` (1.9 / 2.5 on `bg`), `line` (1.2 / 1.5 on `bg`), `music-line` (1.54 / 2.0 on `bg`). `music`, `accent` and `admin` fail as text in dark (2.3–3.3:1) and `music` is 4.08 on light `bg`: keep them fills.
  - Team colours need an ink that reaches 4.5:1: pass `--team-ink` (한화 `#FF6600` takes `#191919` at 6.0:1; white on it is 2.9:1).

### Type
- One family: **SUIT Variable** (`fonts/SUIT-Variable.woff2`, weights 100–900, SIL OFL 1.1), then Pretendard, then `sans-serif` (`font-sans`). Every style inherits `letter-spacing: -0.2px`; headings tighten to -0.4…-0.8px, `caption` and `badge` sit at 0, and `eyebrow` opens to +0.04em.
- **Body:** `body` 15px/1.55 is the base. `article` 15px/1.8 for post bodies. `body-sm` 14px/1.6 for comments, review excerpts, album track names and single-line inputs.
- **UI:** `control` 14px/1.3/700 is the workhorse: every 40px button label, genre chips (600 idle, 800 selected), sort links, page numbers; sidebar links take it at 500, and 등록 at 15px/800. `control-sm` 13px/1.3/700 for the segmented tabs, the 검색 key and comment and review bylines. `caption` 12px/1.4/700 for sidebar group heads and comment actions. `meta` 12px/1.5/500 for dates, counts, artist lines, durations and the IP tag, always `muted` or darker, tabular. `badge` 12px/1/700 for every 20px label. `eyebrow` 12px/1/800/+0.04em for HOT.
- Set nothing below 12px, so dense Hangul (쓴, 관) stays open.
- **Headings:** `board-title` 28px/1.25/800 (on the sort control's baseline), `post-title` 24px/1.35/800, `section-title` 22px/1.35/800, `modal-title` 20px/1.4/800, `card-title` 17px/1.45/800, `list-title` 16px/1.45/700 (HOT titles; the recommended song takes it at 15px).
- **Display:** `brand` 22px/1.2/900 for the wordmark, `album-title` 30px/1.25/900 with `word-break: keep-all`, `score` 28px/1.2/900 in `accent-ink`, tabular.
- Weight carries hierarchy: 500 for 12px meta, sidebar links and track names; 600 for idle chips, tabs, auth links and page numbers; 700 for buttons, labels and list titles; 800 for headings and every selected state; 900 only for the wordmark capitals, the album title and the score.
- Korean prose (HOT titles, review excerpt, comments) breaks between words: `word-break: keep-all; overflow-wrap: anywhere`. Single-line list items truncate with an ellipsis.

### Shape
- The corner says what a thing does:
  - `radius-pill` (999px) = pressable: every 40px button, the 48px Kakao and Apple keys, genre chips, the segmented control and its tabs, page numbers (36px circles), auth links, and the search bar with its 검색 key (one control).
  - `radius-sm` (12px) = a field you fill in or a tile: `.field`, `.field-area`, `.logo-badge`, album art in lists, the cover's bars. Nothing pressable uses it.
  - `radius-xs` (6px) = a label that only describes: `.tag` and the 공지, team, 관리자 and 글쓴이 labels; also the focus corners of bare text buttons.
  - `radius-lg` (24px) = large containers: sidebar, HOT cards, review card, comments and replies, track trays, post table, modals. Rows inside an 8px-padded container take `calc(radius-lg - space-2)` = 16px, so corners stay concentric.
  - `radius` (18px) = the site's mid containers only (album cover and images in a post, embedded video, search results, dropdown panel). The bundle does not use it.
- Control heights are fixed: 32px (segmented tabs, header 검색 key), 36px (chips, page circles, sidebar rows, auth links, 검색 key), 40px (buttons, header search), 44px (등록, fields, search pill, album track rows), 48px (Kakao, Apple).

### Spacing
- Take every gap and padding from the 4px grid: `space-1` 4px, `space-2` 8px, `space-3` 12px, `space-4` 16px, `space-5` 20px, `space-6` 24px, `space-8` 32px, `space-10` 40px, `space-12` 48px.
- `space-5` pads every card and comment horizontally, so text in a column starts 20px in. `space-4` is the content stack step (board title row → chips → service picker → trays) and the HOT grid gap. `space-8` is the sidebar-to-content gap, `space-10` separates page sections, `space-12` ends the page and long forms.

### Layout
- Header and shell share one grid: max width 1180px, centred, a 232px sidebar column then content, `space-8` (32px) gap, `space-5` (20px) side padding. `.header-inner` adds an `auto` column for `.user-actions` and pads `space-4` vertically; the search pill starts on the content column, 40px high and up to 520px wide. `.shell` pads `space-8` on top and `space-12` at the bottom.
- HOT widgets: `.widget-container` is always 4 equal columns (`repeat(4, minmax(0, 1fr))`, `space-4` gap, `space-10` below), never 3 + 1.
- `.board-title-row` sets the `board-title` h1 and the sort links on one baseline, `space-4` above the chips.
- The bundle has no responsive rules. The site's breakpoint is **840px**: the sidebar becomes a drawer behind a hamburger and table rows become cards, with an extra-narrow tweak at 380px; iOS safe-area insets are respected at top and bottom. The site's album grid is `repeat(auto-fill, minmax(140px, 1fr))` with square covers.

### Motion
- Transition transform, shadow and filter over `0.2s`; colour and background-colour over `0.15s`.
- Hover lifts: cards `translateY(-2px)` with `shadow-md`; gradient buttons `translateY(-1px)`. `:active` drops the lift and sinks.
- Drawer, backdrop and modals are not in the bundle; keep the site's motion for them: drawer and backdrop on `cubic-bezier(0.16, 1, 0.3, 1)`, 0.45s in and 0.72s out, the backdrop blurring to 6px over 45% black; modals over 50% black with a 4px blur.

### Focus and states
- **Focus** is the only outside ring: `outline: 2px solid` `focus` at `outline-offset: 2px` on every link, button, field and `[tabindex]` element, drawn as an outline so it survives forced-colours mode. `focus` is `music` in light and `music-ink` in dark. Exceptions: the search pill rings while its input is focused, and a focused 검색 key rings itself at offset 0; segmented tabs draw the ring 2px inside (`-2px`); sort links draw it at 4px, clear of the underline.
- **Selected** looks one way: `music-soft` fill, `box-shadow: inset 0 0 0 1px` `music-line`, `music-ink` text at 800, flat (no drop). It marks the active genre chip, the current sidebar board, the current page and the playing track row, which adds the three-bar mark. The edge is 1px and inset, so it never reads as focus. Two idioms keep their own "on": the service segmented control (a raised `panel` thumb with `shadow-xs`, `text` at 800) and sort links (`text` at 800 with a 2px `music-mark` underline). A chip with a team colour fills with `--team-color` and `shadow-fill`.
- **Hover** on anything selectable (chips, boards, pages, rows, sort links) never borrows the selected colour: it steps to `panel-alt` (page numbers rise to `panel` + `shadow-xs`) and the text to `text`; sort links gain a `muted-2` underline; comment actions underline. Filled buttons darken to their `-hover` tokens.
- **Disabled:** `disabled-opacity` (0.4), no shadow, default cursor. Never the only cue for a state that must be read.
- **Forced colours:** the wordmark and the mask glyphs paint `CanvasText`, selected states `SelectedItem` / `SelectedItemText`, and surfaces and keys get a 1px system outline in place of their shadows. Keep that block when you extend the bundle.
- Repaint browser autofill to `field` and `text` so the browser's blue does not break the well; the bundle ships no autofill rule.

## Iconography
- There is no icon library. Draw the few glyphs as CSS masks painted with `currentColor` or a token, or as inline SVG with `stroke="currentColor"`, `stroke-width="2"` and round caps (the site's 24×24 hamburger).
- `--eq-mask` is the logo's three bars (20×16 viewBox). It leads the HOT eyebrow (15×12, `accent-ink`) and marks the playing track (`music-ink`). Use it only for "hot" and "now playing".
- `--search-mask` is the magnifier (24×24 viewBox, 2.4 stroke, round caps), drawn at 16×16 in `muted` at the left of `.search`.
- The brand mark is three rounded bars like an equalizer (see Logos); on the badge it is `on-accent` white.
- Glyphs carry data only: ★ / ☆ ratings in `accent-ink` (no gradient fill), ♥ before the recommend count, a `muted` middle dot before comment dates (hidden from assistive tech), ‹ › pagination arrows at 20px/500. No emoji.
- Third-party sign-in buttons keep their vendor colours: Kakao `#FEE500` with `#191919`; Apple `apple-fill` / `apple-ink`.
- Baseball team badges and chips use each KBO team's own colour, set inline from `app.js` (`background` on `.team-badge`, `--team-color` on `.team-tab-btn`). Pass `--team-ink` wherever white on the team colour falls under 4.5:1.

## Not synced
- **Design refresh, site unchanged:** this system is a design refresh of the site's current `style.css`. The site has not been changed yet and still shows the previous look (surfaces the same grey as the page, gradient text for active states). Build new work to this system, not to the live stylesheet.
- **Variables skipped:** `--border` (`transparent` in `style.css`, not a colour value). `accent-gradient` is recorded with its light value and is theme-aware in `components/bundle.css`. The bundle's own custom properties (`--eq-mask`, `--search-mask`) and the consumer hooks `--team-color`, `--team-ink` and `--elbow` are not tokens.
- **Components:** the product has no component library (plain HTML + `style.css` + `app.js`). Cards show **static renditions** styled by `components/bundle.css`; there is no `bundle.js`. The desktop page frame is carried (`.site-header`, `.header-inner`, `.shell`, `.widget-container`, `.board-title-row`). Not carried: the 840px drawer and mobile layout, post table (`.dc-table`) and its mobile card layout, modals, custom select, write toolbar, album detail header, album grid, settings panel, star input, YouTube/Apple players, footer.
