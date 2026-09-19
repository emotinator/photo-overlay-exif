// Pure-function tests for the Grid export-size option.
// Extracts the REAL function sources out of photo-overlay-app.html and runs
// them in Node against stubs — no browser, no localStorage, no session state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'photo-overlay-app.html', 'utf8');

function extract(name) {
  const start = html.indexOf(`\nfunction ${name}(`);
  if (start < 0) throw new Error(`could not find function ${name}`);
  let i = html.indexOf('{', start), depth = 0, end = -1;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return html.slice(start, end);
}

const src = ['gridSpec', 'gridGeometry', 'gridExportWidth', 'gridExportWidthScaled'].map(extract).join('\n\n');
const make = new Function('G', 'GRID_SPECS', 'ratioHF',
  `${src}\nreturn { gridGeometry, gridExportWidth, gridExportWidthScaled };`);

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) pass++;
  else { fail++; console.error(`FAIL ${label}: got ${got}, want ${want}`); }
}

// 4-up 2×2, square canvas; cell bitmap native width drives the export width
function grid(nativeCellW, exportScale) {
  const G = { count: 4, variant: 0, gutterPct: 0, exportScale, cells: [] };
  if (nativeCellW) {
    for (let i = 0; i < 4; i++) G.cells[i] = { bitmap: {}, crop: { outW: nativeCellW, scale: 1 } };
  }
  return make(G, { 4: [[2, 2]] }, () => 1);
}

eq('empty grid, full',        grid(0, 1).gridExportWidthScaled(), 2048);
eq('empty grid, half',        grid(0, 0.5).gridExportWidthScaled(), 1024);
eq('mid-res, full',           grid(1500, 1).gridExportWidthScaled(), 3000);
eq('mid-res, half',           grid(1500, 0.5).gridExportWidthScaled(), 1500);
eq('ceiling clamp, half',     grid(9000, 0.5).gridExportWidthScaled(), 2048);
eq('floor clamp, half (not re-floored to 1600)', grid(100, 0.5).gridExportWidthScaled(), 800);
eq('full-res width untouched by scale', grid(1500, 0.5).gridExportWidth(), 3000);

// Half-size geometry is the full-size geometry × 0.5
const f = grid(1500, 1), h = grid(1500, 0.5);
const rf = f.gridGeometry(f.gridExportWidthScaled()), rh = h.gridGeometry(h.gridExportWidthScaled());
eq('canvas height halves', rh.H, rf.H / 2);
rf.rects.forEach((r, i) => {
  eq(`cell ${i} w halves`, rh.rects[i].w, r.w / 2);
  eq(`cell ${i} x halves`, rh.rects[i].x, r.x / 2);
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
