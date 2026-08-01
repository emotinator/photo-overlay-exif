// Pure-function tests for Layout frame geometry.
// Extracts the REAL function sources out of photo-overlay-app.html and runs
// them against a stub L — no browser, no localStorage, no session state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'photo-overlay-app.html', 'utf8');

const NEEDED = ['getOutputDims', 'clampOffsetFor', 'selectedRatio',
                'borderReserve', 'photoAspect', 'refreshLayoutFrame',
                'rebaseBlocksToCanvas'];

// Grab `function name(...) { ... }` by brace-matching from the declaration.
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

const src = NEEDED.map(extract).join('\n\n');
const L = {};
const BORDER_MAX_RESERVE = 0.8, CANVAS_MAX_PX = 8000;
const ctx = { L, BORDER_MAX_RESERVE, CANVAS_MAX_PX, console };
const fns = new Function('L', 'BORDER_MAX_RESERVE', 'CANVAS_MAX_PX', 'console',
  src + '\nreturn {' + NEEDED.join(',') + '};')(L, BORDER_MAX_RESERVE, CANVAS_MAX_PX, console);

const { refreshLayoutFrame, borderReserve, photoAspect, rebaseBlocksToCanvas } = fns;

// ── harness ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  → ' + detail : ''}`); }
};
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

function setup({ ratio = '4:5', src = [6000, 4000], border = {}, outside = {} } = {}) {
  L.cropRatio = ratio;
  L.imageBitmap = { width: src[0], height: src[1] };
  L.crop = { scale: 1, offsetX: 0, offsetY: 0, outW: 0, outH: 0 };
  L.border = Object.assign({ top: 0, right: 0, bottom: 0, left: 0, color: '#fff' }, border);
  L.border.outside = Object.assign({ top: false, right: false, bottom: false, left: false }, outside);
  L.frame = null;
  return refreshLayoutFrame();
}

console.log('\n1. Canvas always matches the selected aspect ratio');
for (const ratio of ['4:5', '1:1']) {
  const R = ratio === '1:1' ? 1 : 4 / 5;
  const cases = [
    ['no border', {}, {}],
    ['all IN 10%', { top: 10, right: 10, bottom: 10, left: 10 }, {}],
    ['bottom OUT 12%', { bottom: 12 }, { bottom: true }],
    ['all OUT 8%', { top: 8, right: 8, bottom: 8, left: 8 }, { top: 1, right: 1, bottom: 1, left: 1 }],
    ['mixed: top IN 3 / bottom OUT 15', { top: 3, bottom: 15 }, { bottom: true }],
    ['asymmetric OUT L4 R11 T2 B20', { left: 4, right: 11, top: 2, bottom: 20 },
      { left: 1, right: 1, top: 1, bottom: 1 }],
  ];
  for (const [label, b, o] of cases) {
    const f = setup({ ratio, border: b, outside: o });
    ok(`${ratio} ${label}: ${f.canvasW}×${f.canvasH}`,
      near(f.canvasW / f.canvasH, R, 0.002), `ratio ${(f.canvasW / f.canvasH).toFixed(4)} vs ${R}`);
  }
}

console.log('\n2. A 12% bottom OUT chin is exactly 12% of canvas width');
{
  const f = setup({ ratio: '4:5', border: { bottom: 12 }, outside: { bottom: true } });
  ok('chin px === 0.12 × canvasW', near(f.btm, 0.12 * f.canvasW, 1),
    `${f.btm} vs ${(0.12 * f.canvasW).toFixed(1)}`);
  ok('photo box + chin === canvas height', f.photoH + f.btm === f.canvasH,
    `${f.photoH} + ${f.btm} !== ${f.canvasH}`);
  ok('photo spans full width (no L/R reserve)', f.photoW === f.canvasW);
  ok('photo starts at y=0', f.photoY === 0);
}

console.log('\n3. IN edges reserve nothing');
{
  const f = setup({ ratio: '4:5', border: { top: 10, right: 10, bottom: 10, left: 10 } });
  ok('photo fills the canvas', f.photoW === f.canvasW && f.photoH === f.canvasH);
  ok('photo origin at 0,0', f.photoX === 0 && f.photoY === 0);
  ok('border widths still computed for painting', f.t > 0 && f.any);
}

console.log('\n4. Mixed IN/OUT reserves only the OUT edges');
{
  const f = setup({ ratio: '4:5', border: { top: 3, bottom: 15 }, outside: { bottom: true } });
  ok('top IN does not offset the photo', f.photoY === 0);
  ok('bottom OUT reserves', f.photoH === f.canvasH - f.btm, `${f.photoH} vs ${f.canvasH - f.btm}`);
  ok('width untouched', f.photoW === f.canvasW);
}

console.log('\n5. Photo box never exceeds the source (no transparent slivers)');
{
  const shapes = [[6000, 4000], [4000, 6000], [3000, 3000], [8000, 1200], [1200, 8000]];
  for (const s of shapes) {
    for (const ratio of ['4:5', '1:1', 'original']) {
      const f = setup({ ratio, src: s, border: { top: 9, right: 6, bottom: 21, left: 6 },
        outside: { top: 1, right: 1, bottom: 1, left: 1 } });
      const sampledW = f.photoW / L.crop.scale, sampledH = f.photoH / L.crop.scale;
      ok(`${ratio} src ${s[0]}×${s[1]} samples within source`,
        sampledW <= s[0] + 0.001 && sampledH <= s[1] + 0.001,
        `sampled ${sampledW.toFixed(1)}×${sampledH.toFixed(1)} from ${s[0]}×${s[1]}`);
    }
  }
}

console.log('\n6. Degenerate guard: wide "original" ratio cannot be over-reserved');
{
  const f = setup({ ratio: 'original', src: [9000, 3000],
    border: { top: 25, bottom: 25, left: 25, right: 25 },
    outside: { top: 1, right: 1, bottom: 1, left: 1 } });
  ok('canvas is positive', f.canvasW > 0 && f.canvasH > 0, `${f.canvasW}×${f.canvasH}`);
  ok('photo box is positive', f.photoW > 0 && f.photoH > 0, `${f.photoW}×${f.photoH}`);
  ok('ratio still 3:1', near(f.canvasW / f.canvasH, 3, 0.01));
  const g = borderReserve();
  ok('vertical reserve clamped to 80% of height', g.innerHU > 0,
    `innerHU=${g.innerHU.toFixed(4)}`);
}

console.log('\n7. Canvas size cap holds');
{
  const f = setup({ ratio: '4:5', src: [8000, 8000],
    border: { left: 25, right: 25 }, outside: { left: 1, right: 1 } });
  ok('canvas within CANVAS_MAX_PX', Math.max(f.canvasW, f.canvasH) <= CANVAS_MAX_PX,
    `${f.canvasW}×${f.canvasH}`);
  ok('ratio survives the cap', near(f.canvasW / f.canvasH, 0.8, 0.002));
}

console.log('\n8. photoAspect() drives the crop stage to the same box');
{
  for (const [b, o] of [[{ bottom: 12 }, { bottom: true }],
                        [{ left: 10, bottom: 18 }, { left: 1, bottom: 1 }],
                        [{ top: 5 }, {}]]) {
    const f = setup({ ratio: '4:5', border: b, outside: o });
    const a = photoAspect();
    ok(`derived aspect matches photo box (${JSON.stringify(o)})`,
      near((a.w / a.h) / (f.photoW / f.photoH), 1, 0.005),
      `aspect ${(a.w / a.h).toFixed(4)} vs box ${(f.photoW / f.photoH).toFixed(4)}`);
  }
}

console.log('\n9. v2→v3 block rebase');
{
  // No OUT edges → identity
  const lay1 = { cropRatio: '4:5', marginPct: 5, blocks: [{ x: 10, y: 40, w: 60, sizePct: 4 }] };
  rebaseBlocksToCanvas(lay1, { top: 8, bottom: 8, outside: {} });
  ok('no OUT edges leaves blocks untouched',
    lay1.blocks[0].x === 10 && lay1.blocks[0].y === 40 && lay1.blocks[0].w === 60);

  // Bottom OUT 20% on 4:5: canvasH/photoW = 1/0.8 + 0.2 = 1.45; photo occupies
  // the top 1.25/1.45 of the canvas, so a block at y=100% lands at 86.2%.
  const lay2 = { cropRatio: '4:5', marginPct: 5, blocks: [{ x: 0, y: 100, w: 100, sizePct: 4 }] };
  rebaseBlocksToCanvas(lay2, { bottom: 20, outside: { bottom: true } });
  ok('bottom OUT rebases y', near(lay2.blocks[0].y, 1.25 / 1.45 * 100, 0.01),
    `y=${lay2.blocks[0].y.toFixed(3)} vs ${(1.25 / 1.45 * 100).toFixed(3)}`);
  ok('bottom-only OUT leaves x/w alone', lay2.blocks[0].x === 0 && lay2.blocks[0].w === 100);

  // Left+right OUT 10% each: canvasW/photoW = 1.2, photo starts at x=1/12
  const lay3 = { cropRatio: '4:5', marginPct: 6, blocks: [{ x: 0, y: 50, w: 100, sizePct: 6 }] };
  rebaseBlocksToCanvas(lay3, { left: 10, right: 10, outside: { left: true, right: true } });
  ok('side OUT rebases x', near(lay3.blocks[0].x, 0.1 / 1.2 * 100, 0.01),
    `x=${lay3.blocks[0].x.toFixed(3)}`);
  ok('side OUT rescales w', near(lay3.blocks[0].w, 100 / 1.2, 0.01), `w=${lay3.blocks[0].w.toFixed(3)}`);
  ok('side OUT rescales sizePct', near(lay3.blocks[0].sizePct, 6 / 1.2, 0.001));
  ok('side OUT rescales margin', near(lay3.marginPct, 6 / 1.2, 0.001));

  // Block centred in the photo stays centred in the photo
  const lay4 = { cropRatio: '1:1', marginPct: 5, blocks: [{ x: 40, y: 45, w: 20, sizePct: 4 }] };
  rebaseBlocksToCanvas(lay4, { bottom: 25, outside: { bottom: true } });
  const kY = 1 + 0.25;   // R=1 → canvasH/photoH = 1.25
  ok('1:1 + bottom OUT rebases y', near(lay4.blocks[0].y, 0.45 / kY * 100, 0.01),
    `y=${lay4.blocks[0].y.toFixed(3)} vs ${(0.45 / kY * 100).toFixed(3)}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
