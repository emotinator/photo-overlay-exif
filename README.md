# Photo Overlay — EXIF

A single-file browser-based tool for compositing camera EXIF metadata and lighting notes over portrait photographs — inspired by the overlay style popularized by photographers sharing behind-the-scenes shooting data on social media.

No installation. No server. No build step. Just open the `.html` file in a browser.

---

## Screenshot

> Load an image → set your crop → adjust the overlay → export.

---

## Features

### Image
- **Drag & drop** or file picker to load JPEG, PNG, TIFF, HEIC
- **Interactive crop** — pan and zoom the image within a fixed aspect ratio frame before committing
- Aspect ratio presets: **4:5**, **1:1**, **Original**
- Rule-of-thirds grid overlay during crop
- **Blur** and **Darken** sliders for the background image effect

### EXIF
- Automatically extracts and displays:
  - Aperture, Shutter Speed, ISO, Focal Length
  - Camera body, Lens, Date & Time
- Uses [exifr](https://github.com/MikeKovarik/exifr) for broad format support including Sony ARW, Canon CR3, Nikon NEF, and standard JPEG/TIFF

### Overlay
- **Lighting notes** text field with saved presets (click to re-use)
- Full text position controls: margins (both sides), text width, vertical offset, horizontal offset
- Typography controls: font size scale, line height
- Optional **text drop shadow** with blur, opacity, X/Y offset
- Material Symbols icons for each EXIF field
- Configurable divider line opacity

### Profile
- Photographer name (© copyright line), Instagram handle, website
- Toggle visibility of each credit line independently
- All settings **auto-saved to localStorage** and restored on next open

### Export
- **JPEG** and **PNG** export at full source resolution
- Native **Save As dialog** in Chrome/Edge (File System Access API)
- Fallback to browser download in Firefox/Safari
- Export profile + presets + all settings to **`.json`** or **`.md`**

---

## Usage

1. Download `photo-overlay-app.html`
2. Open it in Chrome, Edge, Firefox, or Safari
3. Load a photo via drag & drop or the file picker
4. Set your crop — drag to pan, scroll to zoom, press **R** to reset
5. Click **Apply Crop**
6. Fill in your lighting notes, adjust overlay settings
7. Export JPEG or PNG

That's it.

---

## Requirements

- A modern browser (Chrome 86+, Edge 86+, Firefox 90+, Safari 15.2+)
- Internet connection on first load (Google Fonts + exifr CDN)

> **Offline use:** Once the fonts and exifr library have been cached by your browser, the app will continue to work without a connection. For a fully self-contained offline build, the CDN dependencies can be inlined manually.

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Core functionality | ✅ | ✅ | ✅ | ✅ |
| EXIF extraction | ✅ | ✅ | ✅ | ✅ |
| Native Save As dialog | ✅ | ✅ | ⬇ Download | ⬇ Download |
| Pinch-to-zoom crop | ✅ | ✅ | ✅ | ✅ |

---

## Settings Persistence

All overlay settings are automatically saved to `localStorage` and restored the next time you open the file in the same browser. This includes:

- Photographer profile (name, Instagram, website)
- All slider values (blur, darken, margins, font scale, shadow, etc.)
- Crop ratio preference
- Lighting note presets

Settings can also be exported as a `.json` or `.md` file for backup or sharing via the header buttons.

---

## Lighting Presets

Type your lighting setup notes into the **Lighting Notes** field and click **+ Save as Preset**. Saved presets appear as buttons — click **Use** to instantly load them into the field for the current image.

---

## Dependencies

All loaded from CDN — no `npm install` required.

| Library | Purpose |
|---|---|
| [exifr v7](https://github.com/MikeKovarik/exifr) | EXIF metadata extraction |
| [Google Fonts — Syne, DM Mono, Instrument Serif](https://fonts.google.com) | UI typography |
| [Google Material Symbols Outlined](https://fonts.google.com/icons) | Overlay icons |

---

## Planned / Future

- Custom font selection for overlay text
- Additional custom text fields beyond lighting notes
- Import settings from `.json` file
- Multiple export size options (e.g. resize for Instagram vs. full resolution)
- Offline / self-contained build

---

## License

MIT — free to use, modify, and distribute.

---

## Credits

Overlay style inspired by the work of **Elmer Erana** ([@elmererana.portraits](https://www.instagram.com/elmererana.portraits) / [elmererana.com](https://elmererana.com)).

Built with Claude.
