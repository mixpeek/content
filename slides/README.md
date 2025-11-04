# Slides Deck Usage

A minimal, no-transition slide deck system. Each numbered HTML file (e.g., `1.html`, `2.html`, `3.html`) in a folder is a full-screen slide. The folder’s `index.html` loads the deck and lets you navigate instantly via scroll or keys.

## Quick start

1. Create a folder under `slides/` (e.g., `slides/my-deck/`).
2. Add numbered slides: `1.html`, `2.html`, `3.html`, ...
3. Add an `index.html` like:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Deck</title>
  <link rel="stylesheet" href="../deck.css">
</head>
<body>
  <script>
    // Number of slides in this folder
    window.DECK_MAX_SLIDES = 6;
  </script>
  <script src="../deck.js"></script>
</body>
</html>
```
Open the folder’s `index.html` in your browser.

## Controls

- Next: ArrowRight, ArrowDown, PageDown, Space, Enter
- Previous: ArrowLeft, ArrowUp, PageUp, Backspace
- Jump: Home (first), End (last)
- Mouse wheel: advances one slide (instant)

## Configure slide count

- Preferred: set `window.DECK_MAX_SLIDES = N` in the deck page.
- Alternative: query param `index.html?max=N`.

## Start at a specific slide

Use a hash: `index.html#3` starts on slide 3.

## Make slides interactive (optional)

By default, slide iframes have `pointer-events: none` so scrolling/keys always work.
If you need clickable content inside slides:
1) In `slides/deck.css`, remove `pointer-events: none;` from `.deck-slide iframe`.
2) Be aware the slide content may capture wheel/keys; add handlers in slides if needed.

## Troubleshooting

- Missing slides: non-existent files are hidden. Ensure `DECK_MAX_SLIDES` matches your highest slide number.
- After resize: the deck re-snaps; reload if alignment seems off.

## Structure

- `slides/core/` — shared runtime and styles
  - `deck.js`: builds the deck and handles navigation
  - `deck.css`: layout, snap behavior, progress indicator
- `slides/<your-deck>/` — a deck folder with numbered HTML slides
  - `1.html`, `2.html`, ...
  - `index.html` — generated or hand-authored deck entry
- `slides/build_decks.js` — generator for `index.html` in each deck folder

## Generator (optional)

You can auto-generate `index.html` for each deck folder.

Run:
```bash
node slides/build_decks.js
```

### deck.json (optional per deck)

Place a `deck.json` inside a deck folder to explicitly define slides and a title.
```json
{
  "title": "My Deck",
  "slides": ["1.html", "2.html", "intro.html", "conclusion.html"]
}
```
If `deck.json` is absent, the generator discovers `*.html` files and infers slide count from numbered filenames.

### Using core assets

Generated `index.html` will reference `../core/deck.css` and `../core/deck.js`.
