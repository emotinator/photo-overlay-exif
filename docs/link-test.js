// Pure-function tests for linked Border/Matte edges (M8).
// Extracts the REAL function sources out of photo-overlay-app.html and runs
// them against a stub L — no browser, no localStorage, no session state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'photo-overlay-app.html', 'utf8');

const NEEDED = ['linkedSides', 'applyBorderWidth', 'applyBorderMode',
                'setAllBorderLinks', 'borderLinkAllState', 'adoptTemplateBorder'];

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
function extractConst(name) {
  const re = new RegExp(`^const ${name} = .*$`, 'm');
  const m = html.match(re);
  if (!m) throw new Error(`could not find const ${name}`);
  return m[0];
}

const src = extractConst('BORDER_EDGES') + '\n' + NEEDED.map(extract).join('\n\n');
const L = {};
const fns = new Function('L', 'console',
  src + '\nreturn {' + NEEDED.join(',') + '};')(L, console);

const { linkedSides, applyBorderWidth, applyBorderMode, setAllBorderLinks,
        borderLinkAllState, adoptTemplateBorder } = fns;

// ── harness ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  → ' + detail : ''}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// `link`/`out`/`w` are sparse: any edge left out defaults to off / 0.
function setup({ w = {}, out = {}, link = {} } = {}) {
  L.border = Object.assign({ top: 0, right: 0, bottom: 0, left: 0, color: '#fff' }, w);
  L.border.outside = Object.assign({ top: false, right: false, bottom: false, left: false }, out);
  L.borderLink = Object.assign({ top: false, right: false, bottom: false, left: false }, link);
}
const widths = () => BORDER_EDGES_LOCAL.map(s => L.border[s]);
const modes = () => BORDER_EDGES_LOCAL.map(s => !!L.border.outside[s]);
const links = () => BORDER_EDGES_LOCAL.map(s => !!L.borderLink[s]);
const BORDER_EDGES_LOCAL = ['top', 'right', 'bottom', 'left'];

console.log('\n1. linkedSides — a slider only gangs when its OWN box is checked');
{
  setup({ link: { right: true, bottom: true } });
  ok('unchecked edge answers with itself alone', same(linkedSides('top'), ['top']),
    JSON.stringify(linkedSides('top')));
  ok('checked edge answers with every checked edge',
    same(linkedSides('right'), ['right', 'bottom']), JSON.stringify(linkedSides('right')));

  setup({ link: { top: true, right: true, bottom: true, left: true } });
  ok('all checked answers in canonical order',
    same(linkedSides('bottom'), ['top', 'right', 'bottom', 'left']),
    JSON.stringify(linkedSides('bottom')));

  setup({ link: { left: true } });
  ok('the only checked edge answers with itself', same(linkedSides('left'), ['left']));
}

console.log('\n2. applyBorderWidth — linked edges match exactly');
{
  setup({ w: { top: 2, right: 3, bottom: 4, left: 5 }, link: { top: true, bottom: true } });
  const touched = applyBorderWidth('top', 9);
  ok('linked edges take the new value', L.border.top === 9 && L.border.bottom === 9,
    `top=${L.border.top} bottom=${L.border.bottom}`);
  ok('unlinked edges are untouched', L.border.right === 3 && L.border.left === 5,
    `right=${L.border.right} left=${L.border.left}`);
  ok('returns the sides it changed', same(touched, ['top', 'bottom']), JSON.stringify(touched));
}
{
  setup({ w: { top: 2, right: 3, bottom: 4, left: 5 }, link: { top: true, bottom: true } });
  const touched = applyBorderWidth('right', 9);
  ok('dragging an unchecked edge moves only itself',
    same(widths(), [2, 9, 4, 5]), JSON.stringify(widths()));
  ok('unchecked drag returns just that side', same(touched, ['right']), JSON.stringify(touched));
}
{
  setup({ w: { top: 7, right: 7, bottom: 7, left: 7 }, link: { top: true, right: true, bottom: true, left: true } });
  applyBorderWidth('left', 0);
  ok('0 propagates like any other value', same(widths(), [0, 0, 0, 0]), JSON.stringify(widths()));
}

console.log('\n3. applyBorderMode — IN/OUT follows the same rule');
{
  setup({ out: { top: false, right: true, bottom: false, left: true },
          link: { top: true, right: true, bottom: true } });
  const touched = applyBorderMode('top');
  ok('clicked edge flips', L.border.outside.top === true, `top=${L.border.outside.top}`);
  ok('linked edges copy the clicked edge\'s NEW mode (not their own flip)',
    L.border.outside.right === true && L.border.outside.bottom === true,
    `right=${L.border.outside.right} bottom=${L.border.outside.bottom}`);
  ok('unlinked edge keeps its own mode', L.border.outside.left === true);
  ok('returns the sides it changed', same(touched, ['top', 'right', 'bottom']), JSON.stringify(touched));
}
{
  setup({ out: { top: true, right: true, bottom: true, left: true },
          link: { top: true, right: true, bottom: true, left: true } });
  applyBorderMode('bottom');
  ok('all-OUT linked flips to all-IN', same(modes(), [false, false, false, false]),
    JSON.stringify(modes()));
}
{
  setup({ out: { right: true }, link: { top: true, bottom: true } });
  applyBorderMode('right');
  ok('unchecked edge flips alone', same(modes(), [false, false, false, false]),
    JSON.stringify(modes()));
}

console.log('\n4. setAllBorderLinks — the master checkbox');
{
  setup({ link: { right: true } });
  setAllBorderLinks(true);
  ok('check-all sets every edge', same(links(), [true, true, true, true]), JSON.stringify(links()));
  setAllBorderLinks(false);
  ok('uncheck-all clears every edge', same(links(), [false, false, false, false]),
    JSON.stringify(links()));
}

console.log('\n5. borderLinkAllState — drives checked / indeterminate');
{
  setup({ link: { top: true, right: true, bottom: true, left: true } });
  ok('all → "all"', borderLinkAllState() === 'all', borderLinkAllState());
  setup({});
  ok('none → "none"', borderLinkAllState() === 'none', borderLinkAllState());
  setup({ link: { bottom: true } });
  ok('one → "some"', borderLinkAllState() === 'some', borderLinkAllState());
  setup({ link: { top: true, right: true, left: true } });
  ok('three → "some"', borderLinkAllState() === 'some', borderLinkAllState());
}

console.log('\n6. adoptTemplateBorder — a template carries the look, not the links');
{
  setup({ w: { bottom: 4 }, link: { top: true, bottom: true } });
  adoptTemplateBorder({ top: 9, right: 9, bottom: 20, left: 9,
                        outside: { top: false, right: false, bottom: true, left: false },
                        color: '#000000' });
  ok('the template\'s widths land', same(widths(), [9, 9, 20, 9]), JSON.stringify(widths()));
  ok('applying a template leaves the links alone',
    same(links(), [true, false, true, false]), JSON.stringify(links()));
}
{
  setup({ link: { right: true } });
  adoptTemplateBorder({ top: 1, right: 1, bottom: 1, left: 1,
                        outside: {}, color: '#fff',
                        borderLink: { top: true, right: true, bottom: true, left: true } });
  ok('a borderLink smuggled inside a template border is ignored',
    same(links(), [false, true, false, false]), JSON.stringify(links()));
  ok('and is not left on L.border', L.border.borderLink === undefined,
    JSON.stringify(L.border.borderLink));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
