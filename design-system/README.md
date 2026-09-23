DULI.KR ("너 인디 좋아해?", *Do U Like Indie*) is a Korean indie-music community board: posts, recommended songs, album ratings, gig news and reviews. The interface is **soft neumorphism on one cool grey**, with a single **blue-to-violet gradient** for everything that is active, chosen or primary.

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
- `bg` and `panel` are the **same colour** by design. A surface is told apart from the page only by shadow.
- **Raised** = `panel` + `shadow-sm`: cards, sidebar, post table, secondary buttons. Hover may lift (`translateY(-2px…-4px)`) or deepen to `shadow-md`.
- **Pressed** = `shadow-inset-sm` / `shadow-inset`: every input, the search pill, reply comments, and the **selected** state of tabs, sidebar links and page buttons. `:active` on buttons swaps to `shadow-inset`.
- `panel-alt` is the one recessed tone: row hover, notice rows, `.tag` fill, 1px dividers inside lists.
- **No borders.** `--border` is `transparent` in the source. The only outlined element is the quiet danger button (1px `admin`).
- Anything filled with the gradient uses `accent-glow` instead of the neumorphic shadow, because grey shadows look muddy under colour.
- The sticky header is `panel-glass` with `backdrop-filter: saturate(180%) blur(10px)` and a soft `0 8px 20px` drop in `sh-dark` at 0.12.

### Colour
- **Brand pair:** `music` (blue) and `accent` (violet), almost always used together as `accent-gradient` (135°, blue → violet).
- **Gradient fill** (white text) = primary actions and strong badges: `.write-btn`, `.btn-submit-write`, `.notice-badge`, the selected dropdown option, the logo badge.
- **Gradient text** (`background-clip: text`) = active and hover: active tab, sort link, current page, active board, hover on text buttons and title links, ratings, HOT, 글쓴이.
- `admin` red = danger and staff only: delete, 관리자 badge, dislike, report hover, the comment count in lists.
- Text is `text`; everything secondary is `muted`; `muted-2` is only for marks you don't have to read (empty stars, track numbers, IP tags, disabled items).
- Dark theme swaps every value (see tokens), deepens shadows, and adds a film grain (`grain-opacity` 0.05) to dither banding in soft shadows.
- **Contrast (kept from the source, flagged):** `muted` on `bg` is 3.05:1 in light; `music` as text is 3.1:1 in light; white on `music` is 3.7:1 (light) and 3.1:1 (dark); white on `admin` in dark is 2.8:1. `text` on every surface passes (≥ 8.7:1). Keep small text in `text` where it has to be read.

### Type
- One family: **SUIT Variable**, then Pretendard, then `sans-serif` (`font-sans`). Every style inherits `letter-spacing: -0.2px`; the display/brand style uses `-1px`.
- Base `body` is 15px / 1.55. Post bodies (`article`) open up to 1.75.
- UI runs small: `label` 13px is the workhorse (buttons, tabs, table cells), `meta` 12px for dates and counts, `badge` 11px.
- Weight shows hierarchy more than size: 600 for UI, 700 for headings and buttons, 800 for emphasised titles and active states, 900 only for album titles and the wordmark capitals.
- Korean titles that must not break mid-word use `word-break: keep-all` (album title); single-line lists truncate with an ellipsis.

### Shape
- `radius-sm` 12px (controls), `radius` 18px (cards, comments, textarea), `radius-lg` 26px (big containers, album covers).
- Pills (`border-radius: 999px`) for the header CTA, search, tabs, tags and recommend.
- Small fixed radii for small things: 10px on track covers and badges, 6px on list thumbnails.

### Layout
- Content max width 1180px, centred; desktop grid = 230px sidebar + content, 36px gap, 20px page padding.
- HOT widgets: always 4 equal columns (16px gap), never 3 + 1.
- Album grid: `repeat(auto-fill, minmax(140px, 1fr))`, gap 14px × 16px, square covers.
- Breakpoint **840px**: sidebar becomes a drawer behind a hamburger, table rows become cards. Extra-narrow tweak at 380px. iOS safe-area insets are respected at top and bottom.

### Motion
- Default `transition: 0.2s` (0.15s for colour-only changes).
- Drawer and backdrop: `cubic-bezier(0.16, 1, 0.3, 1)`, 0.45s in, 0.72s out; backdrop blurs to 6px over 45% black.
- Modals: 50% black overlay with a 4px blur.

### Focus and states
- Focus ring: `2px solid music`, `outline-offset: 2px` on links, buttons and fields.
- Hover on gradient fills: `filter: brightness(1.08)`. Disabled: 40% opacity, no shadow.
- Browser autofill is repainted to `bg` / `text`.

## Iconography
- There is no icon library. Icons are a few inline SVGs drawn with `stroke="currentColor"`, `stroke-width="2"`, round caps (e.g. the 24×24 hamburger).
- The brand mark is three rounded bars like an equalizer (see Logos). Ratings use the ★ glyph with a gradient partial fill.
- Third-party sign-in buttons keep their vendor colours: Kakao #FEE500 on #191919; Apple black, or white in dark.
- Baseball team badges and tabs use each KBO team's own colour, set inline from `app.js`.

## Not synced
- **Font file:** SUIT Variable loads from `cdn.jsdelivr.net/gh/sun-typeface/SUIT@2` in the product; the file could not be downloaded here, so previews fall back to Pretendard / system sans until it is added under `fonts/`.
- **Variables skipped:** `--border` (`transparent`, not a colour value). `--accent-gradient` is recorded under Gradient with its light value and is theme-aware in `components/bundle.css`.
- **Components:** the product has no component library (plain HTML + `style.css` + `app.js`). Cards show **static renditions** styled by `components/bundle.css`, copied from `style.css`; there is no `bundle.js`. Not carried: header/shell layout, post table (`.dc-table`) and its mobile card layout, modals, custom select, write toolbar, album detail header, album grid, settings panel, star input, YouTube/Apple players, footer.
