# HANDOFF — Photo Overlay: EXIF

Context document for starting a fresh working session on this project.

---

## Project Location

```
/Users/eerana/Documents/Development/photo-overlay-exif
```

Git repository. Connected via Filesystem MCP — **two servers may appear (`Filesystem` and `filesystem`); query both with `list_allowed_directories` to confirm access.** If write access to the project folder isn't available, route file outputs through `/mnt/user-data/outputs/` for download-and-replace.

```
photo-overlay-exif/
├── photo-overlay-app.html    # The entire application (~1300 lines, single file)
├── README.md                 # GitHub-facing readme
├── ARCHITECTURE.md           # Technical reference — READ THIS FIRST before code changes
├── framedata-settings.json   # Example exported settings
└── assets/                   # Icons8 SVG sources (already embedded as base64 in the app)
```

---

## What This Is

A zero-install, single-HTML-file browser tool for photographers. It composites camera EXIF metadata (aperture, shutter, ISO, focal length), manually-entered lighting setup notes, and photographer credits over a blurred/darkened version of a portrait photo. Output style matches the social-media overlay format used by Elmer Erana (@elmererana.portraits).

**Workflow:** drag & drop image → interactive pan/zoom crop (4:5, 1:1, original) → EXIF auto-populates → type/select lighting notes → adjust overlay controls → export JPEG/PNG at full resolution.

---

## Owner & Working Style

Elmer prefers **direct iterative refinement**: state the change concisely, apply it immediately, deliver the updated file. No extended confirmation loops. Changes are often precise numeric adjustments (font sizes, multipliers, slider ranges, letter spacing, icon codepoints).

---

## Technology Decisions (settled — do not revisit without cause)

| Decision | Choice | Why |
|---|---|---|
| Stack | Single HTML file, vanilla JS | Zero-install, shareable, runs from `file://` |
| EXIF | exifr v7 **UMD build** | ESM build fails on `file://` origins |
| Icons | Icons8 SVGs as **base64 data URIs**, canvas `source-in` white tint | Material Symbols ligatures don't work in canvas `fillText` |
| UI fonts | Montserrat 900/300/100 (titles/menus), DM Mono (data) | Brand look; mono for values |
| Canvas text | Helvetica Neue/Arial bold | Reliable canvas rendering |
| Save dialogs | File System Access API + `<a download>` fallback | Native Save As in Chrome/Edge; Firefox/Safari get downloads |
| Persistence | localStorage, declarative key tables | See ARCHITECTURE.md §8 |
| Theme | CSS custom properties, `[data-theme="light"]` | Dark default, toggle in header |

---

## Current State: Feature-Complete v1

Everything below is implemented and working:

- Full-window drag & drop with overlay indicator; file picker fallback
- Interactive crop stage: drag-pan, scroll/pinch zoom (1×–5×), rule-of-thirds grid, R-to-reset, re-crop preserves transform
- Blur (0–30px) and darken (0–85%) image effects
- EXIF extraction and formatted display (sidebar grid + canvas overlay)
- Lighting notes with saved presets (save/use/delete)
- Text position: symmetric margins (2–20%), text width (35–100%), V offset (±30%), H offset (±40%)
- Typography: font scale (60–250%, default 150%), line height (100–200%)
- Optional text drop shadow (blur/opacity/X/Y, resolution-scaled)
- Photographer profile (name/©, Instagram, website) with per-line show/hide
- Divider line with opacity control
- Light/dark mode toggle (header, persisted)
- All settings auto-persist to localStorage; export to .json/.md
- JPEG/PNG export at full source resolution with native Save As dialog
- Icon-to-text gap tuned to `iconSize * 1.7`

---

## Where This Is Heading (stated intent)

The owner is about to **expand the application with a different mode**. The specifics of that mode were not yet defined at handoff. ARCHITECTURE.md §14 documents how modes/stages work structurally and the rules a new mode should follow (base-unit sizing, persistence tables, `cropApplied` render gate, CSS variables for both themes).

Other discussed-but-unbuilt items:
- Custom font selection for overlay text
- Additional freeform custom text fields
- Settings **import** from .json (export exists, import does not)
- Export resize options (e.g. 1080px Instagram variant)
- Fully offline build (inline the Google Fonts + exifr CDN assets)
- Cleanup: remove the now-unused Material Symbols `<link>` from `<head>`

---

## First Steps for a New Session

1. Confirm filesystem access: run `list_allowed_directories` on the filesystem server(s); expect `/Users/eerana/Documents/Development/photo-overlay-exif`
2. Read `ARCHITECTURE.md` before touching the canvas, crop math, or persistence
3. Copy `photo-overlay-app.html` into the working sandbox before editing; deliver the full updated file back (project-folder write or outputs download)
4. Ask Elmer what the new mode is — that's the next piece of work
