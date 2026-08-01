// Pure-function tests for Layout templates.
// Extracts the REAL function sources out of photo-overlay-app.html and runs
// them in Node against stubs — no browser, no localStorage, no session state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'photo-overlay-app.html', 'utf8');

const NEEDED = ['uniqueTemplateName', 'templateDefaultName', 'newTemplateId',
                'templateSummary', 'adoptTemplateBlocks', 'tplNum', 'tplColor',
                'tplStr', 'sanitizeTemplateBlock', 'sanitizeTemplateFrame',
                'parseTemplateJson'];

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

const src = ['TEMPLATE_FORMAT', 'TPL_MAX_BLOCKS', 'TPL_IMG_MAX', 'TPL_SRC_RE']
  .map(extractConst).join('\n') + '\n' + NEEDED.map(extract).join('\n\n');

const L = { blocks: [], nextId: 1 };

// TEMPLATES is a module-level `let` in the app; recreate that binding here so
// uniqueTemplateName/templateDefaultName close over it exactly as they do live.
const fns = new Function('L', `
  let TEMPLATES = [];
  ${src}
  return { api: {${NEEDED.join(',')}},
           get: () => TEMPLATES, set: v => { TEMPLATES = v; } };
`)(L);
const api = fns.api;
const setTemplates = fns.set, getTemplates = fns.get;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  → ' + detail : ''}`); }
};

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

console.log('\n1. Name collisions get suffixed, rename keeps its own name');
{
  setTemplates([{ id: 't1', name: 'Polaroid' }, { id: 't2', name: 'Polaroid (2)' }]);
  ok('fresh name passes through', api.uniqueTemplateName('Filmstrip') === 'Filmstrip');
  ok('clash suffixes to (3)', api.uniqueTemplateName('Polaroid') === 'Polaroid (3)',
    api.uniqueTemplateName('Polaroid'));
  ok('renaming to own name is a no-op', api.uniqueTemplateName('Polaroid', 't1') === 'Polaroid');
  ok('renaming onto a sibling still suffixes',
    api.uniqueTemplateName('Polaroid (2)', 't1') === 'Polaroid (2) (2)');
}

console.log('\n2. Default name comes from the first non-empty text block');
{
  setTemplates([]);
  L.blocks = [{ type: 'image' }, { type: 'text', text: '  \n' },
              { type: 'text', text: 'Shot on Leica Q3\nsecond line' }];
  ok('uses first line of first real text', api.templateDefaultName() === 'Shot on Leica Q3',
    api.templateDefaultName());
  L.blocks = [{ type: 'image' }];
  ok('falls back to a counter', api.templateDefaultName() === 'Template 1',
    api.templateDefaultName());
  L.blocks = [{ type: 'text', text: 'x'.repeat(200) }];
  ok('long text is truncated to 32', api.templateDefaultName().length === 32);
}

console.log('\n3. Applied blocks always get fresh ids');
{
  L.blocks = []; L.nextId = 7;
  const tpl = { blocks: [{ id: 'b1', type: 'text', text: 'a' }, { id: 'b1', type: 'text', text: 'b' }] };
  api.adoptTemplateBlocks(tpl);
  const ids = L.blocks.map(b => b.id);
  ok('ids are unique', new Set(ids).size === 2, ids.join(','));
  ok('ids advance nextId', L.nextId === 9, String(L.nextId));
  ok('source template not mutated', tpl.blocks[0].id === 'b1');
  ok('deep copy — editing applied block leaves template alone',
    (L.blocks[0].text = 'CHANGED', tpl.blocks[0].text === 'a'));
}

console.log('\n4. Summary line describes the frame');
{
  const chin = { frame: { cropRatio: '4:5', border: { bottom: 12, outside: { bottom: true } } },
                 blocks: [1, 2, 3] };
  ok('names the chin', api.templateSummary(chin) === '4:5 · chin 12% · 3 blocks',
    api.templateSummary(chin));
  const plain = { frame: { cropRatio: '1:1', border: {} }, blocks: [1] };
  ok('singular block', api.templateSummary(plain) === '1:1 · 1 block', api.templateSummary(plain));
  const all = { frame: { cropRatio: 'original',
    border: { top: 4, right: 4, bottom: 4, left: 4, outside: { top: 1, right: 1, bottom: 1, left: 1 } } },
    blocks: [] };
  ok('all-round matte', api.templateSummary(all) === 'original · matte all · 0 blocks',
    api.templateSummary(all));
}

console.log('\n5. Import REJECTS hostile and malformed payloads');
{
  setTemplates([]);
  const reject = (label, text) => {
    const r = api.parseTemplateJson(text);
    ok(label, typeof r === 'string', 'accepted: ' + JSON.stringify(r).slice(0, 90));
  };
  reject('not JSON', '{oops');
  reject('not an object', '"hello"');
  reject('wrong kind', JSON.stringify({ kind: 'something-else', blocks: [] }));
  reject('blocks not an array', JSON.stringify({ blocks: { a: 1 } }));
  reject('empty block list', JSON.stringify({ blocks: [] }));
  reject('too many blocks', JSON.stringify({ blocks: Array(201).fill({ type: 'text' }) }));
  reject('unknown block types only', JSON.stringify({ blocks: [{ type: 'iframe' }] }));

  // The security cases: image src must be an inline base64 image data URL.
  const badSrc = s => JSON.stringify({ blocks: [{ type: 'image', src: s }] });
  reject('javascript: src', badSrc('javascript:alert(1)'));
  reject('data:text/html src', badSrc('data:text/html;base64,PHNjcmlwdD4='));
  reject('remote http src', badSrc('https://evil.example/x.png'));
  reject('CSS-breakout src', badSrc('data:image/png;base64,AAA");background:url(//evil'));
  reject('protocol-relative src', badSrc('//evil.example/x.png'));
  reject('svg with inline script payload', badSrc('data:image/svg+xml,<svg onload=alert(1)>'));
}

console.log('\n6. Import ACCEPTS and sanitizes good payloads');
{
  setTemplates([]);
  const good = JSON.stringify({
    kind: 'photo-overlay-layout-template', v: 1, name: 'Polaroid w/ credit',
    frame: { cropRatio: '4:5', marginPct: 5, blur: 0, darken: 0,
             border: { top: 4, right: 4, bottom: 16, left: 4,
                       outside: { top: true, right: true, bottom: true, left: true },
                       color: '#f0e8d8' } },
    blocks: [
      { id: 'b1', type: 'text', text: 'SHOT ON LEICA', x: 10, y: 93, w: 80, sizePct: 3.2,
        align: 'center', color: '#111111', font: { family: 'Inter', weight: 700, italic: false },
        lineHeight: 1.25, letterSpacing: 0, opacity: 100,
        shadow: { enabled: false, blur: 12, opacity: 70, x: 0, y: 2 } },
      { id: 'b2', type: 'image', src: PNG, aspect: 2, w: 20, x: 6, y: 6, name: 'Logo',
        filters: { invert: 0, grayscale: 0, brightness: 100, contrast: 100 } },
    ],
  });
  const r = api.parseTemplateJson(good);
  ok('accepted', typeof r === 'object', String(r));
  ok('both blocks survive', r.blocks.length === 2);
  ok('no blocks dropped', r.dropped === 0);
  ok('name preserved', r.name === 'Polaroid w/ credit');
  ok('frame preserved', r.frame.cropRatio === '4:5' && r.frame.border.bottom === 16 &&
     r.frame.border.outside.bottom === true && r.frame.border.color === '#f0e8d8');
  ok('image src preserved', r.blocks[1].src === PNG);
  ok('gets a fresh id', typeof r.id === 'string' && r.id.startsWith('t'));

  // Mixed payload: the good block survives, the hostile one is dropped.
  const mixed = api.parseTemplateJson(JSON.stringify({
    blocks: [{ type: 'text', text: 'ok' }, { type: 'image', src: 'javascript:alert(1)' }],
  }));
  ok('mixed payload keeps the safe block', typeof mixed === 'object' && mixed.blocks.length === 1);
  ok('mixed payload reports the drop', mixed.dropped === 1, String(mixed && mixed.dropped));
}

console.log('\n7. Sanitizer clamps hostile values');
{
  const b = api.sanitizeTemplateBlock({
    type: 'text', x: 1e9, y: -1e9, w: 0, sizePct: 99999, opacity: 500,
    lineHeight: -4, letterSpacing: 900, align: 'justify', color: 'red; background:url(x)',
    font: { family: 'a'.repeat(500), weight: 9999 },
    text: 'z'.repeat(99999), evil: '<script>',
  });
  ok('x clamped', b.x === 500, String(b.x));
  ok('y clamped', b.y === -500, String(b.y));
  ok('w floored above zero', b.w === 0.5, String(b.w));
  ok('sizePct clamped', b.sizePct === 200, String(b.sizePct));
  ok('opacity clamped', b.opacity === 100, String(b.opacity));
  ok('lineHeight clamped', b.lineHeight === 0.5, String(b.lineHeight));
  ok('bad align falls back', b.align === 'left');
  ok('non-hex color rejected', b.color === '#ffffff', b.color);
  ok('font family truncated', b.font.family.length === 80);
  ok('weight clamped', b.font.weight === 900, String(b.font.weight));
  ok('text truncated', b.text.length === 5000);
  ok('unknown keys dropped', !('evil' in b), Object.keys(b).join(','));

  const f = api.sanitizeTemplateFrame({ cropRatio: 'evil', marginPct: 1e6, blur: -5, darken: 999,
    border: { top: 900, color: 'url(evil)', outside: { top: 'yes' } } });
  ok('bad ratio falls back to 4:5', f.cropRatio === '4:5');
  ok('border width clamped to 25', f.border.top === 25, String(f.border.top));
  ok('border color rejected', f.border.color === '#ffffff');
  ok('outside coerced to boolean', f.border.outside.top === true);
  ok('margin clamped', f.marginPct === 50, String(f.marginPct));
  ok('darken clamped', f.darken === 100, String(f.darken));
  ok('blur floored', f.blur === 0, String(f.blur));
}

console.log('\n8. Export → import round-trip');
{
  setTemplates([]);
  const original = {
    v: 1, id: 't9', name: 'Round trip', created: '2026-07-31T00:00:00.000Z',
    frame: api.sanitizeTemplateFrame({ cropRatio: '1:1', marginPct: 8, blur: 3, darken: 20,
      border: { top: 2, right: 2, bottom: 14, left: 2,
                outside: { top: 0, right: 0, bottom: 1, left: 0 }, color: '#101010' } }),
    blocks: [api.sanitizeTemplateBlock({ type: 'text', text: 'Hello', x: 10, y: 88, w: 80,
      sizePct: 4, align: 'center', color: '#eeeeee', font: { family: 'Inter', weight: 600 } })],
  };
  const exported = JSON.stringify({
    kind: 'photo-overlay-layout-template', v: 1, exportedAt: '2026-07-31T00:00:00.000Z',
    name: original.name, frame: original.frame, blocks: original.blocks,
  }, null, 2);
  const back = api.parseTemplateJson(exported);
  ok('round-trips', typeof back === 'object', String(back));
  ok('frame identical', JSON.stringify(back.frame) === JSON.stringify(original.frame));
  ok('blocks identical', JSON.stringify(back.blocks) === JSON.stringify(original.blocks));
  ok('name identical', back.name === original.name);
  ok('id is regenerated, not reused', back.id !== original.id);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
