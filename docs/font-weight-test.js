// Pure-function tests for font weight requests (M10).
// Extracts the REAL function sources out of photo-overlay-app.html and runs
// them in Node — no browser, no network, no session state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'photo-overlay-app.html', 'utf8');

const NEEDED = ['googleFontCssUrl', 'pickFontWeight'];

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
  const m = html.match(new RegExp(`^const ${name} = .*$`, 'm'));
  if (!m) throw new Error(`could not find const ${name}`);
  return m[0];
}

const src = extractConst('FONT_WEIGHT_STEPS') + '\n' + NEEDED.map(extract).join('\n\n');
const fns = new Function('console', src + '\nreturn {' + NEEDED.join(',') + ', FONT_WEIGHT_STEPS};')(console);
const { googleFontCssUrl, pickFontWeight, FONT_WEIGHT_STEPS } = fns;

// The curated table itself is data worth checking — it is generated from a
// probe of the Google API and a typo there is invisible until a font 404s.
const CURATED = new Function('return ' + html.match(/const CURATED_FONTS = (\[[\s\S]*?\n\]);/)[1])();

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  → ' + detail : ''}`); }
};

console.log('\n1. googleFontCssUrl — a variable font asks for its range, not a list');
{
  const u = googleFontCssUrl({ f: 'Montserrat', w: [100, 200, 300, 400, 500, 600, 700, 800, 900], variable: true });
  ok('variable font requests min..max',
    u === 'https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap', u);

  const o = googleFontCssUrl({ f: 'Oswald', w: [200, 300, 400, 500, 600, 700], variable: true });
  ok('the range is the font\'s OWN axis, never a blanket 100..900',
    o === 'https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap', o);

  const c = googleFontCssUrl({ f: 'Crimson Text', w: [400, 600, 700] });
  ok('a static family lists its weights',
    c === 'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&display=swap', c);

  const s = googleFontCssUrl({ f: 'Abril Fatface', w: [400] });
  ok('a single-weight family asks for just that weight',
    s === 'https://fonts.googleapis.com/css2?family=Abril+Fatface:wght@400&display=swap', s);

  ok('spaces in the family name become +',
    googleFontCssUrl({ f: 'Space Grotesk', w: [300, 700], variable: true }).includes('family=Space+Grotesk:'),
    googleFontCssUrl({ f: 'Space Grotesk', w: [300, 700], variable: true }));

  ok('a system font has no URL to fetch',
    googleFontCssUrl({ f: 'Helvetica Neue', w: [400, 700], sys: true }) === null);
}

console.log('\n2. pickFontWeight — switching family keeps the weight when it exists');
{
  const spec = { f: 'Inter', w: [100, 200, 300, 400, 500, 600, 700, 800, 900] };
  ok('an available weight is kept', pickFontWeight(spec, 300) === 300);
  ok('an unavailable weight falls back to 700',
    pickFontWeight({ f: 'Crimson Text', w: [400, 600, 700] }, 300) === 700);
  ok('without 700 it falls back to the lightest available',
    pickFontWeight({ f: 'DM Mono', w: [300, 400, 500] }, 900) === 300);
  ok('a single-weight family always lands on it',
    pickFontWeight({ f: 'Anton', w: [400] }, 100) === 400);
  ok('a missing spec still yields a usable weight', pickFontWeight(null, 300) === 400);
}

console.log('\n3. CURATED_FONTS — the generated table is self-consistent');
{
  const bad = [];
  CURATED.forEach(o => {
    if (o.sys) return;
    if (!Array.isArray(o.w) || !o.w.length) return bad.push(`${o.f}: no weights`);
    if (o.w.some(w => !FONT_WEIGHT_STEPS.includes(w))) bad.push(`${o.f}: non-standard weight`);
    if (o.w.some((w, i) => i && w <= o.w[i - 1])) bad.push(`${o.f}: not sorted/unique`);
    // A range request only covers a contiguous run of 100 steps.
    if (o.variable) {
      const span = (o.w[o.w.length - 1] - o.w[0]) / 100 + 1;
      if (span !== o.w.length) bad.push(`${o.f}: variable but weights are not contiguous`);
      if (o.w.length < 2) bad.push(`${o.f}: variable with a single weight`);
    }
  });
  ok('every curated font has sorted, standard, consistent weights', !bad.length, bad.join(' | '));
  ok('the light weights actually arrived',
    CURATED.find(o => o.f === 'Montserrat').w.includes(100) &&
    CURATED.find(o => o.f === 'Inter').w.includes(100) &&
    CURATED.find(o => o.f === 'Oswald').w.includes(200));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
