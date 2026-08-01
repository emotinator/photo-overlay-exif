# M5 — Unified border/matte geometry (Layout mode)

Status: on `feature/layout-border-frame`, awaiting owner evaluation.

## The problem

Layout mode had three competing ways to draw a border, each with its own
reference frame:

| Mode | Applied | Border % relative to | Final ratio |
|---|---|---|---|
| Bake (`border.preCrop`) | padded `srcBitmap` **before** the crop | **original image width** | selected ✓ (crop could slice the border off) |
| IN (inset) | masked the cropped image's edges | output width | selected ✓ |
| OUT (outset) | grew the canvas past the crop | output width | **broken** ✗ |

Bake was anchored to the source bitmap, so a 10% chin on a 6000px original
became an arbitrary fraction of a 4:5 crop, and panning in the crop tool could
eat it. OUT was the only mode that abandoned the selected aspect ratio. The two
were also mutually exclusive in the UI — `updateBorderSideButtons()` hid the
IN/OUT toggles whenever bake was on.

## The model

One concept. Every edge is **IN** or **OUT**:

- **IN** — paints over the photo's edge. Reserves nothing; the photo still
  fills the canvas.
- **OUT** — reserves a strip. The photo area shrinks to whatever is left.
  This is the old "bake", done correctly: the matte is part of the frame, it
  can never be cropped away, and the ratio holds.

Two invariants:

1. Border widths are **always % of the final canvas width** — all four edges
   come out equal in px, and the matte is resolution-independent.
2. The output canvas **always** matches the selected aspect ratio.

The photo's crop ratio is therefore *derived* from the space the OUT edges
leave behind. That is what lets a polaroid chin exist without breaking 4:5.

`border.preCrop`, `rebuildLayoutSource()`, `refreshLayoutCropAfterSourceChange()`,
`L.srcBitmap`, and `L._padL/_padT` are all gone.

## The math

With `R` = selected ratio (w/h) and `Sx`/`Sy` = summed OUT-edge percentages per
axis (both as fractions of canvas **width**, which is what keeps corners square):

```
photoRatio         = (1 − Sx) / (1/R − Sy)
{photoW, photoH}   = getOutputDims(imageBitmap, {w: 1−Sx, h: 1/R−Sy})
canvasW            = round(photoW / (1 − Sx))
canvasH            = round(canvasW / R)
photoX, photoY     = left/top OUT widths in px
```

`getOutputDims()` already accepted a `{w,h}` object, so the derived ratio drops
straight in. Resolution still comes from the source — the photo is never
upscaled; a large OUT matte grows the canvas instead.

Guards:

- `BORDER_MAX_RESERVE = 0.8` — OUT edges may not eat more than 80% of an axis.
  Without this, a wide `original` ratio (a 3:1 panorama) can be asked for a
  matte 150% of its own height. Contributing edges scale down proportionally.
- `CANVAS_MAX_PX = 8000` — a big source plus wide side mattes would otherwise
  balloon the export.
- A scale floor (`photoW/srcW`, `photoH/srcH`) absorbs ±1px rounding so
  `drawImage` can never sample past the bitmap edge and leave a transparent
  sliver.

`refreshLayoutFrame()` owns all of it, writes the canvas-exact photo dims back
into `L.crop`, and caches the result on `L.frame`. Preview and export both read
it through `layoutFrame()` and share one painter, `paintLayoutFrame()`, so they
cannot drift apart.

## Block space

Block coords (`x`, `y`, `w`, `sizePct`) and `marginPct` are now % of the **full
canvas**, matte included, and the editor overlay covers the whole frame. You can
drag a caption into the chin, onto an inset matte, or straddling the seam. The
`ctx.translate(ox, oy)` that kept blocks photo-relative at export is gone, and
`LV.W/LV.H` collapsed into `LV.TW/LV.TH`.

Consequence: `sizePct` is % of canvas width, so on a design with a large chin,
text is slightly larger relative to the photo than it used to be. This is the
intended behavior going forward.

## Migration (schema 2 → 3)

Added as a `v === 2` step in the existing stepwise `migrateStorage()`.

- `preCrop: true` → all four edges OUT, flag deleted. Blocks need no rebase:
  under the bake, the canvas *was* the photo area.
- No OUT edges → identity. Old photo area equalled the canvas. **Common case.**
- OUT edges present → `rebaseBlocksToCanvas()` converts photo-relative coords to
  canvas-relative. The factors come from the stored percentages alone
  (`canvasW/photoW = 1 + lOut + rOut`, `canvasH/photoW = 1/R + tOut + bOut`).

Known gap: `cropRatio: 'original'` leaves `R` unknown at migration time (the
image isn't persisted), so vertical coords are left as-is and may drift. It
requires a saved OUT border *and* original-ratio *and* persisted blocks; logged
via `console.warn` rather than worked around.

## Verification

`frame-test.js` (scratchpad) extracts the real function sources out of the HTML
and drives them in Node against a stub `L` — no browser, no session state.
54 assertions covering: canvas ratio held across IN/OUT/mixed on 4:5 and 1:1;
chin px = exactly 12% of canvas width; IN reserves nothing; photo box never
exceeds the source across five source shapes × three ratios; the panorama
clamp; the size cap; `photoAspect()` agreeing with the photo box; and all four
migration branches.

Live checks in a throwaway origin (port 8749, so the owner's localStorage at
8741 is untouched): chin renders and exports at 1770×2213 with the seam and
caption in the right places, export dims match the frame exactly, the crop stage
re-fits live when a border slider moves mid-crop, a seeded v2 payload migrates
correctly on boot, and EXIF + Grid modes are unaffected.

## Open question for evaluation

Border paints *under* blocks (unchanged). An IN matte therefore does not clip a
block that overlaps it. If you'd rather an inset matte behave like a true window
that crops everything, that's a one-line reorder in `paintLayoutFrame()`.
