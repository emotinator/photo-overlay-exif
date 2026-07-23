# Photo Overlay (EXIF/Layout/Grid)

A single-file, browser-based composition tool for photographers — three tools in one page, sharing a common shell, crop system, and export pipeline.

No installation. No server. No build step. Just open `photo-overlay-app.html` in a browser and pick a mode from the header.

---

## The three modes

### EXIF
The original overlay tool: composites camera metadata and lighting notes over a photograph, in the style popularized by photographers sharing behind-the-scenes shooting data.

- Automatic EXIF extraction via [exifr](https://github.com/MikeKovarik/exifr): aperture, shutter, ISO, focal length, camera, lens, date/time (broad format support incl. Sony ARW, Canon CR3, Nikon NEF)
- Lighting-notes field with saved presets
- Full text position, typography, and drop-shadow controls; blur/darken background treatment
- Photographer profile (© name, Instagram, website) with per-line visibility toggles

### Layout
A freeform block editor for magazine tearsheets, posters, and polaroid-style compositions.

- **Text and image blocks** over your cropped photo — or over a **blank canvas** in any color
- Drag, resize, duplicate, z-order; double-click to edit text inline
- **Margins & snapping**: an adjustable margin box (negative allowed) clamps dragging; blocks snap to margins and center lines while moving *and* resizing (hold Alt to bypass)
- **Typography**: 27 curated Google Fonts plus a custom font collection — add any Google-hosted family by name or URL; weights auto-detected. Size, weight, align, line height, letter spacing, color, drop shadow
- **Image blocks**: CSS filters (invert / grayscale / brightness / contrast) and an alpha-preserving **color tint** for recoloring transparent logos; a persistent image collection for reusable marks
- **Border / matte**: per-edge widths with per-edge inset (masks the image) or outside (expands the canvas) modes — or **bake the border into the image before cropping** so the finished composition keeps its aspect ratio (the polaroid-chin effect)
- WYSIWYG guarantee: the on-screen preview and the exported canvas share one wrap/measure function — line breaks cannot diverge

### Grid
A multi-image grid composer (contact sheets, nine-ups, diptychs).

- 1–12 cells with sensible arrangements (vertical/horizontal variants for 2–3)
- Overall ratio 1:1 or 4:5; gutter width and gutter/background color
- **Per-cell images with per-cell crop** — click a cell to select it, then re-crop, replace, or clear from the contextual action row; drop multiple files to fill empty cells in order
- **Per-cell captions**: anchored to any corner, edge-center, or center, with edge offset, font, size, color, opacity, and optional drop shadow — plus a global caption band below the grid
- Export size is driven by the weakest cell's native resolution (clamped 1600–4096 px wide) so no source is upscaled

---

## Shared machinery

- **Crop stage** (all modes, incl. every grid cell): drag to pan, scroll/pinch or the zoom slider (100–500%) to zoom, `R` to reset; cursor-anchored zooming
- **Export**: JPEG (q0.93) / PNG at full resolution; native Save As dialog in Chrome/Edge, download fallback elsewhere
- Light/dark theme; settings export to `.json` / `.md`
- Everything persists to `localStorage` and restores on next open — profile, sliders, presets, layout blocks, custom fonts, image collection, grid settings. Blank-canvas layouts restore completely; loaded photos and grid cell images are session-only

---

## Usage

1. Open `photo-overlay-app.html` in Chrome, Edge, Firefox, or Safari
2. Pick a mode: **EXIF | Layout | Grid** in the header
3. Load images by click, drag & drop, or paste
4. Crop, compose, export

## Requirements

- A modern browser (Chrome 105+, Edge 105+, Firefox 110+, Safari 16+); Chrome/Edge recommended for the native save dialog
- Internet on first load (Google Fonts + exifr CDN); cached thereafter. Custom Google Fonts require a connection when first added

| Feature | Chrome / Edge | Firefox / Safari |
|---|---|---|
| Core functionality (all modes) | ✅ | ✅ |
| Native Save As dialog | ✅ | ⬇ Download |
| Canvas letter-spacing parity | ✅ | approximate |

## Dependencies (all CDN, no npm)

| Library | Purpose |
|---|---|
| [exifr v7](https://github.com/MikeKovarik/exifr) | EXIF metadata extraction |
| [Google Fonts](https://fonts.google.com) | UI typography + the Layout/Grid font system |

## Docs

Internal architecture and design notes live in [`/docs`](docs/) — start with `TECHNICAL.md`.

## License

MIT — free to use, modify, and distribute.

## Credits

Overlay style inspired by the work of **Elmer Erana** ([@elmererana.portraits](https://www.instagram.com/elmererana.portraits) / [elmererana.com](https://elmererana.com)).

Built with Claude.
