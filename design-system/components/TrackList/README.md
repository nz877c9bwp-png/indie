# TrackList

Album track list and recommended-song list; clicking a row plays it.

Copied from `style.css` (`.ad-tracklist`, `.rec-tracklist` and their rows).

## Variants
- Album (`.ad-tracklist`): a CSS counter numbers each row in `muted-2`; duration right-aligned, tabular.
- Recommended (`.rec-tracklist`): 44×44 cover (10px radius), song (14.5px/700) over artist (12.5px `muted`); no numbers.

## States
Rows with a playable link get `.rec-track-clickable`: hover fills `panel-alt` and turns the song name into gradient text. `.rec-track-playing` holds that look while playing; the player opens in a `panel-alt` row under it.
