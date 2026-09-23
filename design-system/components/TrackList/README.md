Album track list and recommended-song list; clicking a playable row plays it.

## Structure
A raised tray (`.ad-tracklist` as an `<ol>` or `.rec-tracklist` as a `<ul>`: `panel`, `radius-lg`, `shadow-sm`, padding `space-2`) holding rounded rows `space-1` apart, with no hairlines. Rows (`.ad-track-row`, `.rec-track-row`) pad `space-2` `space-3` with a `space-3` gap and 16px corners (`radius-lg` − `space-2`, concentric with the tray).

## Variants
- Album (`.ad-tracklist`): a CSS counter numbers each row 01, 02, 03 in `muted` at 12px/600, tabular. `.ad-track-name` is 14px/500 `text`, truncated; `.ad-track-dur` is `meta` in `muted`, tabular, at the right. Rows are at least 44px.
- Recommended (`.rec-tracklist`): `.rec-track-art` at 44×44 (`radius-sm`, `object-fit: cover`, `panel-alt` placeholder, `shadow-art` sleeve), then `.rec-track-text` with `.rec-track-song` (15px/700 `text`) over `.rec-track-artist` (12px/500 `muted`); both truncate. No numbers.

## Consumer supplies
Track names and durations (album), or art URL, song and artist (recommended). Add `.rec-track-clickable` only to rows with a playable link and `.rec-track-playing` to the one playing row. For keyboard access add `tabindex="0"` and Enter/Space handlers; the bundle draws the focus ring. The embedded player is not part of this component.

## States
- `.rec-track-clickable`: pointer; hover fills `panel-alt`, never the selected colour.
- `.rec-track-playing`: `music-soft` fill with a 1px `music-line` inner edge; the title turns `music-ink` at 800 (the album duration too), and the logo's three bars in `music-ink` replace the track number (album) or trail the row (recommended). The artist line stays `muted` (4.7:1 light / 4.8:1 dark on `music-soft`). No gradient title.
- In forced-colours mode the playing row paints `SelectedItem` / `SelectedItemText`.
