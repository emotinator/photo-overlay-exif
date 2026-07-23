# ARCHITECTURE — Photo Overlay: EXIF

Technical reference for how the application works internally. Read this before extending the app with new modes or features.

---

## 1. Application Model

Single HTML file, no build step. Three layers in one document:

| Layer | Location | Notes |
|---|---|---|
| CSS | `<style>` block in `<head>` | Theming via CSS custom properties |
| Markup | `<body>` | Static structure; stages toggled via classes |
| Logic | Two `<script>` blocks at end of `<body>` | UMD lib load + main IIFE-style script |

There is **no virtual DOM, no framework, no reactivity system**. UI updates are explicit: change state → call the relevant render function.

---

## 2. Global State

All app state lives in a single mutable object `S`:

```js
const S = {
  imageFile: null,        // original File object (for filename on export)
  imageBitmap: null,      // ImageBitmap — the decoded source image
  cropRatio: '4:5',       // '4:5' | '1:1' | 'original'
  crop: { scale, offsetX, offsetY, outW, outH },
  cropApplied: false,     // gates overlay rendering
  blur, darken,           // image effect values
  marginPct, textWidthPct, vOffsetPct, hOffsetPct,
  fontScale, lineHeight,
  shadowEnabled, shadowBlur, shadowOpacity, shadowX, shadowY,
  exif: {},               // formatted display strings, not raw EXIF
  lightingNotes: '',
  presets: [],            // [{name, text}]
  profile: { name, instagram, website },
};
```

A second small object `CV` tracks the crop viewport's display dimensions (`CV.W`, `CV.H`).

**Convention:** functions read from `S` directly rather than taking parameters. Any new mode should follow this pattern or explicitly document a departure.

---

## 3. Coordinate Systems (critical for crop work)

Three coordinate spaces are in play. Confusing them is the main source of crop bugs:

1. **Source image space** — pixels of the original `ImageBitmap`. `S.crop.outW/outH` (output dimensions) are defined here.
2. **Scaled image space** — source dimensions × `S.crop.scale`. `S.crop.offsetX/offsetY` are stored in THIS space.
3. **Display space** — the on-screen crop canvas (`CV.W × CV.H`).

Conversions:
```
display px  →  output px:   ÷ (CV.W / outW)
output px   →  source px:   ÷ scale
offsetX (scaled space) → source srcX:  offsetX / scale
```

The crop draw call is always:
```js
srcX = offsetX / scale;  srcW = outW / scale;
ctx.drawImage(bmp, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
```

`clampOffset()` constrains offsets so the crop window never leaves the scaled image bounds. Call it after **every** offset or scale mutation.

Zoom-toward-cursor: convert the cursor to scaled-image space, then recompute offsets so the point under the cursor is invariant across the scale change. See `applyZoomFactor()`.

---

## 4. Rendering Pipeline

`renderOverlay()` renders the **final composite at full output resolution** into `canvas#preview`. The preview element is CSS-scaled down for display; the canvas backing store is full-res, so export is just `canvas.toDataURL()` / `toBlob()` with no re-render.

Order of operations (order matters):

1. `drawImage` the cropped region of the source bitmap
2. **Blur** — `ctx.filter = 'blur(Npx)'` then re-draw the canvas onto itself, then reset filter. (Self-draw with filter is the trick; there is no "apply filter to existing pixels" API.)
3. **Darken** — fill full canvas with `rgba(0,0,0,α)`
4. **Text + icons** — see below

All sizes derive from a base unit: `bu = outW * 0.028 * (fontScale/100)`. Every font size, gap, and icon dimension is a multiple of `bu` (via `BIG`, `MED`, `SM`, `TI`). This keeps the layout resolution-independent — the same settings look identical on a 1200px and 8000px image.

Vertical centering: measure total block height first (stats + lighting lines + divider + meta lines + gaps), then start at `outH/2 + vOffset − totalH/2` and draw top-down, incrementing `y`.

Text wrapping (`wrapText`) is greedy word-wrap using `ctx.measureText` — no hyphenation, no break-word.

### Text shadow
Canvas-native shadow properties (`ctx.shadowColor/Blur/OffsetX/OffsetY`). Shadow values scale by `outW/1000` for resolution independence. Shadow is **explicitly cleared before drawing the divider line** and re-applied after — otherwise the divider gets a smeared glow.

---

## 5. Icon System (SVG-on-canvas)

**History:** Started with Unicode glyphs → Material Symbols font codepoints → current Icons8 SVGs. Material Symbols was abandoned because its ligature-based rendering is unreliable in canvas `fillText`, and codepoint rendering required the font to be fully loaded with correct variant weights — fragile.

**Current approach:**
- Each SVG is embedded in the JS as a **base64 data URI** in `ICON_URIS` (fully offline-safe, no CDN)
- `preloadIcons(cb)` loads all URIs into `Image` objects (`ICONS[key]`) before first render
- `drawIcon(ctx, key, x, y, size, alpha)` draws one icon:
  1. Draw the `Image` to a small offscreen canvas
  2. `globalCompositeOperation = 'source-in'` + white fill → **tints the entire icon white**
  3. Draw the offscreen canvas onto the main canvas with `globalAlpha`

The `source-in` tint trick means source SVG colors are irrelevant — any monochrome SVG works. To add a new icon: base64-encode the SVG, add to `ICON_URIS`, reference by key.

Icon-to-text gap is `iconSize * 1.7` (tuned value).

---

## 6. EXIF Extraction

- Library: **exifr v7, UMD build** (`full.umd.cjs` from unpkg). The ESM build was abandoned — module imports fail unreliably on `file://` origins.
- UMD exposes `window.exifr` synchronously after script load — no readiness handshake needed.
- Parse options: `{ tiff:true, exif:true, gps:false, iptc:false, xmp:false, translateKeys:true, translateValues:true, reviveValues:true }`
- Raw values are formatted immediately into display strings in `processExif()` (e.g. `0.005 → "1/200s"`, `FNumber → "f 8.0"`). `S.exif` holds **display strings only**; raw EXIF is discarded.
- Missing values become `'—'` and are filtered out of the overlay at render time.

---

## 7. Stages & Navigation

The center area has three mutually-exclusive stages, toggled by `showStage(name)` via `.active` classes:

- `#empty-state` — nothing loaded
- `#crop-stage` — interactive crop (canvas + grid overlay canvas + zoom pill)
- `#preview-stage` — final composite preview

Flow: load → crop stage (auto) → Apply Crop → preview. Re-crop returns to crop stage **preserving** the previous transform (`enterCropMode` only resets transform if `!S.cropApplied`).

### Crop interaction events
Bound in `bindCropEvents()`. **Gotcha:** the crop canvas is cloned-and-replaced each time to strip stale listeners (`cloneNode` + `replaceChild`), because enter/exit of crop mode re-binds. Mouse drag state lives in module-level `drag`; wheel zoom steps ±0.06; touch supports one-finger pan and two-finger pinch (midpoint-pivoted).

Scale bounds: 1× (fill frame exactly — never any empty space) to 5×.

---

## 8. Persistence

Two localStorage keys:

- `framedata-settings` — everything: profile, crop ratio, all sliders, all checkboxes. Written by `saveSettings()` on **every** change (slider input, checkbox, profile keystroke, preset change).
- `framedata-presets` — lighting note presets (also duplicated inside saveSettings writes)
- `framedata-theme` — `'dark' | 'light'`

Restore happens once in `loadFromStorage()` on `DOMContentLoaded`, driven by two declarative tables:

```js
SLIDER_KEYS   = [{ key, id, unit, valId }, ...]  // state key ↔ input id ↔ value label id
CHECKBOX_KEYS = [{ key, id }, ...]
```

**To add a new persisted setting:** add to `S`, add a row to the appropriate table, add the field to `saveSettings()` and `exportSettings()`. The tables handle restore automatically.

---

## 9. Export

### Images
`exportImage(format)` — the preview canvas already holds the full-res composite, so export is direct encoding:
- Chrome/Edge: `window.showSaveFilePicker` → native Save As dialog → `canvas.toBlob` → writable stream
- `AbortError` (user cancelled) → silent no-op
- Firefox/Safari: fallback `<a download>` with `canvas.toDataURL`
- JPEG quality: 0.93. Filename: `{original-basename}_overlay.{ext}`

### Settings
`exportSettings('json' | 'md')` — same dual-path save picker/download pattern. JSON is structured by category; MD renders the same data as tables.

---

## 10. Theming

CSS custom properties on `:root` (dark, default) overridden by `[data-theme="light"]` on `<html>`. `applyTheme()` sets the attribute, swaps the toggle glyph (☀/☾), persists. **All colors in the app must go through the variables** — hardcoded colors will break one of the two themes. (This was the bug with the white EXIF logo text; it now uses `var(--text)`.)

Canvas overlay colors are **not** themed — overlay text is always white-on-darkened-image regardless of UI theme.

---

## 11. Full-Window Drag & Drop

Window-level `dragenter/dragleave/dragover/drop` with a **counter** (`dragCounter`) to survive the enter/leave events that fire on every child element. Overlay `#global-drop-overlay` fades in via `.visible`. Non-image files (`!file.type.startsWith('image/')`) are ignored on drop.

---

## 12. Typography (UI)

| Role | Font | Weights used |
|---|---|---|
| Titles, tabs, section labels, buttons | Montserrat | 900 (heavy), 300 (light), 100 (thin) |
| Data values, inputs, sliders, EXIF readouts | DM Mono | 300–500 |
| Canvas overlay text | Helvetica Neue / Arial | bold |

Logo pattern: heavy 900 + thin 100 at the same size, letter-spacing 0.

---

## 13. Known Constraints & Sharp Edges

- **`file://` origin**: no ES modules, no fetch of local files, no service workers. This is why the UMD build and base64 embedding matter. Keep any new dependencies UMD-or-inline.
- **Canvas `ctx.filter` blur** re-draws the canvas onto itself; very high blur values soften edges slightly (edge bleed). Acceptable at current 0–30px range.
- **`showSaveFilePicker`** is Chromium-only; every save path needs the download fallback.
- **Material Symbols `<link>`** may still exist in `<head>` — dead weight, safe to remove.
- **Listener re-binding** on the crop canvas uses clone-and-replace; if you add listeners to the crop canvas elsewhere, they will be silently destroyed on next `enterCropMode()`.
- Icon offscreen canvas is created **per drawIcon call** — fine at current icon counts (≤10/render), would need caching if a mode renders many more.
- `S.exif` holds formatted strings; a new mode needing raw EXIF values must re-parse or extend `processExif` to retain raw fields.

---

## 14. Extension Guidance (for new modes)

- A "mode" today = a stage (`showStage`) + sidebar tab (`switchTab`). Both are simple class togglers — adding a third concept (e.g. mode switcher above tabs) won't conflict.
- Keep all new sizing in the canvas relative to `outW` (the base-unit pattern) or the mode will break at different resolutions.
- Route every new persistent setting through the `SLIDER_KEYS`/`CHECKBOX_KEYS` tables.
- Respect the existing gate: nothing renders until `S.cropApplied` — a new mode that skips cropping needs its own gate or must set `cropApplied` deliberately.
- All user-facing colors through CSS variables; test both themes.
