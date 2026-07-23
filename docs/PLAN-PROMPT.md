# Planning Prompt — Photo Overlay v2: Layout & Grid Modes

> Paste this into a planning-mode session for `photo-overlay-exif`.
> Read `docs/ARCHITECTURE.md` and `docs/TECHNICAL.md` before producing the plan.

---

## Context

`photo-overlay-app.html` is a feature-complete, single-file, zero-build browser tool
that composites EXIF metadata and lighting notes over portrait photos (see docs/).
It is now being expanded from one tool into three, inside the same file and visual
shell. The existing EXIF tool must remain functionally and visually unchanged.

## Objective

Add an app-level **mode switcher in the header** (next to the logo, alongside the
theme toggle) with three modes:

1. **EXIF** — the current app, untouched.
2. **Layout** — a freeform block editor for placing text and logo blocks over a
   cropped photo (magazine tearsheets, movie-poster-style layouts, etc.).
3. **Grid** — a multi-image grid composer (1–12 cells) with per-cell cropping and
   an optional caption area.

Switching modes swaps the sidebar contents and the center stage. Header, theme
toggle, export bar, toast, and global drag & drop remain shared.

---

## Milestone 0 — Rough Layout Check-in (REQUIRED GATE)

**Before writing any production feature code**, deliver a rough, low-fidelity but
*interactive* version of the new shell for review:

- Header mode switcher: EXIF | Layout | Grid (EXIF fully working as today)
- **Layout mode**: a placeholder image on the stage with 2–3 dummy blocks that can
  be selected, dragged, and resized with corner handles. No fonts panel, no
  snapping, no export yet — just prove the editing feel and the sidebar shape
  (a stub "Blocks" panel showing the selected block's name is enough).
- **Grid mode**: a static mock of the grid stage — layout picker (counts 1–12,
  incl. vertical/horizontal variants for 2–3), canvas ratio toggle (1:1 / 4:5),
  cells rendered as empty placeholder slots. Non-functional beyond the picker
  changing the visible arrangement.
- Both themes must look correct.

**STOP after Milestone 0.** Present it, ask for confirmation and layout feedback,
and do not proceed to Milestone 1 until the owner approves. Expect adjustments to
placement, sizing, and interaction feel at this gate — that is its purpose.

---

## Mode 2: Layout — Requirements

### Editing model (decided — do not revisit)
- **DOM editing layer over a display-scaled stage**, not canvas-native editing.
  Blocks are absolutely-positioned elements over the cropped image; the full-res
  canvas is only rendered at export time.
- Drag/resize via `transform: translate()` during interaction (compositor-only;
  Figma-like smoothness is an explicit goal). Commit to stored position on
  pointer-up.
- Block geometry stored as **percentages of image dimensions** so layouts are
  resolution-independent and survive re-crops.
- Text is rendered in the DOM as **explicit pre-wrapped lines** using a single
  shared word-wrap function driven by `canvas.measureText` — the same function
  the exporter uses. DOM preview and canvas export must share wrapping math
  exactly (this is the WYSIWYG guarantee, same philosophy as the EXIF mode).

### Blocks
- Types: **text block** and **image block** (logo insert: PNG or SVG via file
  input; SVG rasterized at full export resolution).
- Text block properties: content (multiline), font family, size, weight,
  alignment (L/C/R), line height, letter spacing, color (default white),
  optional drop shadow (reuse the EXIF shadow model/controls).
- Operations: add, delete, duplicate, z-order (front/back is sufficient),
  select (click), deselect (click empty stage / Esc).
- Selection UI: bounding outline + 8 resize handles. Text blocks: horizontal
  resize re-wraps; height follows content (or corner-resize scales font size —
  planner should propose one and justify).
- Inline text editing: double-click enters an editing state (contenteditable or
  overlay textarea — planner's choice, but exiting edit re-measures and re-wraps
  through the shared wrap function).

### Snapping
- While dragging/resizing, snap block edges and centers to: other blocks' edges
  and centers, stage edges, stage center lines, and margin guides. Threshold
  ~6 display px. Show thin accent-colored guide lines while snapped. Hold a
  modifier (Alt) to disable temporarily.

### Fonts (Google Fonts, dynamic)
- Curated dropdown (~25–30 editorial/display faces) + free-text family input that
  loads any Google-hosted family via the CSS2 API.
- Use `document.fonts.load()`; export must gate on all used fonts being ready.
- Loaded families persist to localStorage and reload on start.
- `fonts.gstatic.com` is CORS-enabled, so canvas export with webfonts works from
  `file://`. Verify tainting does not occur; if a font fails to load, fall back
  to Helvetica and toast a warning rather than blocking export.

### Templates
- Templates are **preset block arrangements**, not locked layouts. Ship at least:
  - *Tearsheet*: logo block top-corner, small credits caption block bottom-corner
    (multi-line: MUA / hair / stylist / photographer / model / assistant).
  - *Poster*: large title block (centered, upper or lower third) + smaller
    byline/credits block beneath it.
  - *Blank*.
- Applying a template populates blocks that are then fully editable.

### Image pipeline
- Same load → crop flow as EXIF mode (reuses the shared crop stage; ratios 4:5,
  1:1, original). Blur/darken sliders remain available in this mode as optional
  background treatment (assumption — flag if the plan differs).
- Re-crop preserves blocks (percentage geometry); a ratio change may shift
  blocks — acceptable, note it in UI copy if trivial to do.

### Export
- Renders blocks onto a full-resolution offscreen/preview canvas (percent → px),
  then flows through the **existing export pipeline unchanged**
  (`showSaveFilePicker` + fallback, JPEG 0.93 / PNG, `_overlay` filename pattern).

---

## Mode 3: Grid — Requirements

- Overall canvas ratio: **1:1 or 4:5**.
- Cell count 1–12. For 2 and 3, offer **vertical and horizontal** arrangements;
  for higher counts use sensible fixed arrangements (2×2, 2×3, 3×3, 3×4 …).
  Planner proposes the full layout table for approval.
- Gutter width control (incl. 0) and gutter/background color (white/black at
  minimum).
- **Per-cell images with per-cell crop**: clicking a cell (or dropping an image
  onto it) enters the shared crop stage scoped to that cell's aspect ratio and
  that cell's own crop transform. Cells are independently re-croppable. Multi-file
  drop fills empty cells in order.
- Optional **caption area**: planner proposes one primary placement (extended
  band below the grid is the assumed default) with configurable height, text,
  font (same font system as Layout mode), size, and alignment. Flag alternatives
  (overlay / dedicated cell) as future options rather than building all three.
- Export composites all cells + gutters + caption at full resolution through the
  existing export pipeline. Output pixel size derives from source resolutions —
  planner proposes the sizing rule (e.g. driven by the smallest cell's native
  crop resolution, capped sensibly).

---

## Required refactors (do carefully — EXIF mode must not regress)

1. **Parameterize the crop system** to operate on a passed crop-state object +
   completion callback instead of writing `S.crop`/`S.cropApplied` directly, so
   EXIF/Layout use the global crop and Grid uses `cells[n].crop`. Same math, same
   interaction code. Fix the known window-listener accumulation in
   `bindCropEvents()` while in there (TECHNICAL.md §5, §10.1).
2. **Namespace state per mode**: keep `S` for EXIF; add `S.layout` and `S.grid`
   (or equivalent) with their own persistence keys. Extend, don't restructure,
   the `SLIDER_KEYS`/`CHECKBOX_KEYS` pattern.
3. Route all new UI colors through the existing CSS variables; both themes must
   work in every new panel and stage.

## Constraints (inherited — see ARCHITECTURE.md §13)

- Single HTML file, no build step, must run from `file://`. New dependencies
  UMD-or-inline only. Ideally zero new libraries — the block editor should be
  hand-rolled vanilla JS.
- All canvas sizing relative to output width (base-unit pattern) where applicable.
- Keep Montserrat/DM Mono UI typography and the gold accent `#c8a96e`.
- Follow the owner's working style: concise iterative changes, deliver the full
  updated file each round.

## Suggested milestone sequence (planner may refine)

- **M0** — Shell + rough interactive mocks → **check-in gate (stop here first)**
- **M1** — Layout mode core: block engine (add/select/drag/resize/edit/delete),
  crop integration, basic font controls, export parity
- **M2** — Snapping + guides; full typography panel; Google Fonts loader;
  templates; persistence
- **M3** — Grid mode: layout table, per-cell crop, gutters, multi-drop, caption,
  export
- **M4** — Polish: cleanup items from TECHNICAL.md §10, settings export coverage
  for new modes, README/docs update

## Deliverable of the planning session

A written implementation plan covering: DOM structure for the new stages and
sidebar panels, the block data model, the shared wrap/measure function design,
the crop parameterization approach, the grid layout table, persistence key
layout, and a risk list — followed by implementation of **Milestone 0 only**,
then stop for review.
