// Pure-function tests for Layout multi-select (M9).
// Extracts the REAL function sources out of photo-overlay-app.html and runs
// them in Node against plain data — no browser, no DOM, no session state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'photo-overlay-app.html', 'utf8');

const NEEDED = ['toggleSelection', 'selectedBlocks', 'clampGroupDelta', 'applyBlockOp'];

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
const fns = new Function('console', src + '\nreturn {' + NEEDED.join(',') + '};')(console);
const { toggleSelection, selectedBlocks, clampGroupDelta, applyBlockOp } = fns;

// ── harness ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  → ' + detail : ''}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = arr => arr.map(b => b.id);

// Four blocks, bottom of the stack first — L.blocks order IS paint order.
const deck = () => [
  { id: 'b1', x: 10, y: 10, w: 20 },
  { id: 'b2', x: 40, y: 10, w: 20 },
  { id: 'b3', x: 10, y: 50, w: 20 },
  { id: 'b4', x: 40, y: 50, w: 20 },
];

console.log('\n1. toggleSelection — Cmd/Ctrl/Shift-click toggles, plain click replaces');
{
  ok('plain click selects just that block',
    same(toggleSelection(['b1', 'b2'], 'b2', 'b3', false), { ids: ['b3'], anchor: 'b3' }),
    JSON.stringify(toggleSelection(['b1', 'b2'], 'b2', 'b3', false)));

  ok('plain click on an already-selected block collapses to it',
    same(toggleSelection(['b1', 'b2'], 'b2', 'b1', false), { ids: ['b1'], anchor: 'b1' }),
    JSON.stringify(toggleSelection(['b1', 'b2'], 'b2', 'b1', false)));

  ok('additive click adds and takes the anchor',
    same(toggleSelection(['b1'], 'b1', 'b3', true), { ids: ['b1', 'b3'], anchor: 'b3' }),
    JSON.stringify(toggleSelection(['b1'], 'b1', 'b3', true)));

  ok('additive click on a selected non-anchor removes it, anchor stays',
    same(toggleSelection(['b1', 'b2', 'b3'], 'b3', 'b1', true), { ids: ['b2', 'b3'], anchor: 'b3' }),
    JSON.stringify(toggleSelection(['b1', 'b2', 'b3'], 'b3', 'b1', true)));

  ok('removing the anchor promotes the last remaining block',
    same(toggleSelection(['b1', 'b2', 'b3'], 'b3', 'b3', true), { ids: ['b1', 'b2'], anchor: 'b2' }),
    JSON.stringify(toggleSelection(['b1', 'b2', 'b3'], 'b3', 'b3', true)));

  ok('removing the only selected block clears the anchor',
    same(toggleSelection(['b1'], 'b1', 'b1', true), { ids: [], anchor: null }),
    JSON.stringify(toggleSelection(['b1'], 'b1', 'b1', true)));

  ok('additive click from an empty selection just selects',
    same(toggleSelection([], null, 'b2', true), { ids: ['b2'], anchor: 'b2' }),
    JSON.stringify(toggleSelection([], null, 'b2', true)));
}

console.log('\n2. selectedBlocks — always canvas order, never click order');
{
  ok('ids given back-to-front still come out in canvas order',
    same(ids(selectedBlocks(deck(), ['b4', 'b1', 'b3'])), ['b1', 'b3', 'b4']),
    JSON.stringify(ids(selectedBlocks(deck(), ['b4', 'b1', 'b3']))));
  ok('an id with no block is ignored',
    same(ids(selectedBlocks(deck(), ['b2', 'gone'])), ['b2']));
  ok('empty selection gives nothing', same(selectedBlocks(deck(), []), []));
}

console.log('\n3. clampGroupDelta — the group stops at the margin as one piece');
{
  const m = { mX: 5, mY: 5 };
  // Group spans x 10..60, y 10..60 (w 20, h 10 each).
  const items = [{ x: 10, y: 10, w: 20, h: 10 }, { x: 40, y: 50, w: 20, h: 10 }];

  ok('a move well inside the margins is untouched',
    same(clampGroupDelta(items, 3, -2, m), { dx: 3, dy: -2 }),
    JSON.stringify(clampGroupDelta(items, 3, -2, m)));

  ok('the leftmost block stops the group at the left margin',
    clampGroupDelta(items, -40, 0, m).dx === -5,
    JSON.stringify(clampGroupDelta(items, -40, 0, m)));

  ok('the rightmost block stops the group at the right margin',
    clampGroupDelta(items, 40, 0, m).dx === 35,   // 40+20=60 → 95
    JSON.stringify(clampGroupDelta(items, 40, 0, m)));

  ok('the topmost block stops the group at the top margin',
    clampGroupDelta(items, 0, -40, m).dy === -5,
    JSON.stringify(clampGroupDelta(items, 0, -40, m)));

  ok('the bottommost block stops the group at the bottom margin',
    clampGroupDelta(items, 0, 40, m).dy === 35,   // 50+10=60 → 95
    JSON.stringify(clampGroupDelta(items, 0, 40, m)));

  // A group too wide to fit between the margins must stay draggable, not jump.
  const wide = [{ x: 0, y: 10, w: 100, h: 10 }];
  ok('a group too wide for the margins is left free',
    clampGroupDelta(wide, 7, 0, m).dx === 7,
    JSON.stringify(clampGroupDelta(wide, 7, 0, m)));
}

console.log('\n4. applyBlockOp — every op acts on the whole selection');
{
  const r = applyBlockOp(deck(), ['b1', 'b3'], 'del', 9);
  ok('del drops every selected block', same(ids(r.blocks), ['b2', 'b4']), JSON.stringify(ids(r.blocks)));
  ok('del clears the selection', same(r.ids, []) && r.anchor === null, JSON.stringify(r));
}
{
  const r = applyBlockOp(deck(), ['b1', 'b3'], 'dup', 9);
  ok('dup appends one copy per selected block',
    same(ids(r.blocks), ['b1', 'b2', 'b3', 'b4', 'b9', 'b10']), JSON.stringify(ids(r.blocks)));
  ok('dup offsets each copy by +2/+2',
    r.blocks[4].x === 12 && r.blocks[4].y === 12 && r.blocks[5].x === 12 && r.blocks[5].y === 52,
    JSON.stringify(r.blocks.slice(4)));
  ok('dup leaves the copies selected', same(r.ids, ['b9', 'b10']) && r.anchor === 'b10',
    JSON.stringify(r));
  ok('dup advances nextId past the copies', r.nextId === 11, String(r.nextId));
  ok('dup copies are independent of their source', r.blocks[4] !== r.blocks[0]);
}
{
  const far = [{ id: 'b1', x: 89, y: 93, w: 20 }];
  const r = applyBlockOp(far, ['b1'], 'dup', 2);
  ok('dup caps the offset at the far edge', r.blocks[1].x === 90 && r.blocks[1].y === 94,
    JSON.stringify(r.blocks[1]));
}
{
  const r = applyBlockOp(deck(), ['b1', 'b3'], 'front', 9);
  ok('front lifts the selection to the top, relative order kept',
    same(ids(r.blocks), ['b2', 'b4', 'b1', 'b3']), JSON.stringify(ids(r.blocks)));
  ok('front leaves the selection alone', same(r.ids, ['b1', 'b3']), JSON.stringify(r.ids));
}
{
  const r = applyBlockOp(deck(), ['b1', 'b3'], 'front', 9, 'b1');
  ok('front keeps the anchor it was handed, not the last id',
    r.anchor === 'b1', String(r.anchor));
}
{
  const r = applyBlockOp(deck(), ['b2', 'b4'], 'back', 9);
  ok('back drops the selection to the bottom, relative order kept',
    same(ids(r.blocks), ['b2', 'b4', 'b1', 'b3']), JSON.stringify(ids(r.blocks)));
}
{
  // One block selected must behave exactly as the single-select app always has.
  ok('single del matches the old behaviour',
    same(ids(applyBlockOp(deck(), ['b2'], 'del', 9).blocks), ['b1', 'b3', 'b4']));
  ok('single front matches the old behaviour',
    same(ids(applyBlockOp(deck(), ['b1'], 'front', 9).blocks), ['b2', 'b3', 'b4', 'b1']));
  ok('single back matches the old behaviour',
    same(ids(applyBlockOp(deck(), ['b4'], 'back', 9).blocks), ['b4', 'b1', 'b2', 'b3']));
}
{
  const d = deck();
  const r = applyBlockOp(d, [], 'del', 9);
  ok('an empty selection is a no-op', same(ids(r.blocks), ids(d)) && r.nextId === 9,
    JSON.stringify(ids(r.blocks)));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
