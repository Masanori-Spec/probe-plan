import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, parseMap, parseSession, parseStrictJSON, createSession, validateSession, setResult, reconcileSession } from '../src/core.mjs';

// Independent reference model: a restricted-growth word labels an equivalence
// relation. No production normalizer, pair generator or connectivity helper is
// used to decide whether a physical connectivity partition passes a plan.
function partitions(n) {
  const out = [];
  const word = [0];
  function visit(max) {
    if (word.length === n) { out.push([...word]); return; }
    for (let label = 0; label <= max + 1; label++) {
      word.push(label);
      visit(Math.max(max, label));
      word.pop();
    }
  }
  visit(0);
  return out;
}
function address(i) {
  return { connector: i % 2 ? 'B' : 'A', pin: String(1 + Math.floor(i / 2)) };
}
function key(endpoint) { return JSON.stringify([endpoint.connector, endpoint.pin]); }
function mapFor(word) {
  const connectors = ['A', 'B'].map(id => ({
    id, label: `Connector ${id}`,
    pins: word.flatMap((_, i) => address(i).connector === id ? [address(i).pin] : []),
  })).filter(connector => connector.pins.length);
  const groups = [];
  word.forEach((label, i) => (groups[label] ??= []).push(address(i)));
  return {
    schema: 'probeplan.pinmap.v1', title: 'Independent partition oracle', connectors,
    nets: groups.flatMap((pins, i) => pins.length > 1 ? [{ id: `net-${i}`, pins }] : []),
    unused: groups.flatMap(pins => pins.length === 1 ? pins : []),
  };
}
function fixture() { return mapFor([0, 0, 1, 1, 2, 3]); }
const clone = value => JSON.parse(JSON.stringify(value));

for (let n = 2; n <= 7; n++) {
  test(`independent oracle: every intended and physical partition of ${n} pins`, () => {
    const possibilities = partitions(n);
    const bell = { 2: 2, 3: 5, 4: 15, 5: 52, 6: 203, 7: 877 };
    assert.equal(possibilities.length, bell[n], 'oracle enumerates known Bell number');
    const index = new Map(Array.from({ length: n }, (_, i) => [key(address(i)), i]));
    for (const intended of possibilities) {
      const plan = compile(mapFor(intended));
      assert.equal(plan.pairs.length, n * (n - 1) / 2, 'all unordered pin pairs are tested');
      const seenIds = new Set();
      const seenPairs = new Set();
      const probes = plan.pairs.map(pair => {
        assert.equal(typeof pair.id, 'string');
        assert.ok(pair.id.length > 0);
        assert.ok(!seenIds.has(pair.id), 'pair ID must be unique');
        seenIds.add(pair.id);
        const a = index.get(key(pair.a));
        const b = index.get(key(pair.b));
        assert.notEqual(a, undefined, 'first endpoint must be declared');
        assert.notEqual(b, undefined, 'second endpoint must be declared');
        assert.notEqual(a, b, 'self probes provide no evidence');
        const pairKey = [Math.min(a, b), Math.max(a, b)].join(':');
        assert.ok(!seenPairs.has(pairKey), 'unordered probes must not repeat');
        seenPairs.add(pairKey);
        assert.ok(['connected', 'not-connected'].includes(pair.expected));
        const connected = intended[a] === intended[b];
        assert.equal(pair.expected, connected ? 'connected' : 'not-connected');
        return [a, b, connected];
      });
      for (const physical of possibilities) {
        const accepted = probes.every(([a, b, expected]) => (physical[a] === physical[b]) === expected);
        const correct = physical.every((label, i) => label === intended[i]);
        if (accepted !== correct) {
          assert.fail(`plan for ${JSON.stringify(intended)} ${accepted ? 'accepted wrong' : 'rejected correct'} physical partition ${JSON.stringify(physical)}`);
        }
      }
    }
  });
}

test('declared minimum and maximum pin counts are supported', () => {
  assert.equal(compile(mapFor([0, 1])).pairs.length, 1);
  const maximum = compile(mapFor(Array.from({ length: 32 }, (_, i) => i)));
  assert.equal(maximum.pairs.length, 496, 'all isolated pins need every pair tested');
  assert.throws(() => compile(mapFor([0])));
  assert.throws(() => compile(mapFor(Array.from({ length: 33 }, (_, i) => i))));
});

test('parseMap round-trip agrees with direct compilation', () => {
  const source = fixture();
  assert.deepEqual(compile(parseMap(JSON.stringify(source))), compile(source));
  for (const input of ['', 'null', '[]', 'true', '42', '{', '{"schema":"wrong"}']) {
    assert.throws(() => parseMap(input), `must reject invalid map JSON ${input}`);
  }
});

test('compiler and session creation do not mutate caller input', () => {
  const source = fixture();
  const before = clone(source);
  const plan = compile(source);
  createSession(plan);
  assert.deepEqual(source, before);
});

const invalidMapCases = [
  ['unknown schema', m => { m.schema = 'probeplan.pinmap.v2'; }],
  ['missing schema', m => { delete m.schema; }],
  ['missing title', m => { delete m.title; }],
  ['numeric title', m => { m.title = 17; }],
  ['empty connector list', m => { m.connectors = []; }],
  ['duplicate connector ID', m => { m.connectors[1].id = m.connectors[0].id; }],
  ['duplicate declared pin', m => { m.connectors[0].pins.push(m.connectors[0].pins[0]); }],
  ['non-string declared pin', m => { m.connectors[0].pins[0] = 1; }],
  ['unassigned pin', m => { m.unused.pop(); }],
  ['duplicate net assignment', m => { m.nets[1].pins.push(clone(m.nets[0].pins[0])); }],
  ['net also marked unused', m => { m.unused.push(clone(m.nets[0].pins[0])); }],
  ['duplicate unused pin', m => { m.unused.push(clone(m.unused[0])); }],
  ['undeclared connector', m => { m.nets[0].pins[0].connector = 'MISSING'; }],
  ['undeclared pin', m => { m.nets[0].pins[0].pin = 'MISSING'; }],
  ['duplicate net ID', m => { m.nets[1].id = m.nets[0].id; }],
  ['empty net', m => { m.nets[0].pins = []; }],
  ['invalid endpoint', m => { m.nets[0].pins[0] = null; }],
  ['unknown top-level field', m => { m.mystery = true; }],
  ['unknown connector field', m => { m.connectors[0].mystery = true; }],
  ['unknown net field', m => { m.nets[0].mystery = true; }],
  ['unknown endpoint field', m => { m.nets[0].pins[0].mystery = true; }],
];
for (const [name, mutate] of invalidMapCases) {
  test(`strict input: reject ${name}`, () => {
    const source = fixture();
    mutate(source);
    assert.throws(() => compile(source));
  });
}

test('session results round-trip without changing the input session', () => {
  const plan = compile(fixture());
  const empty = createSession(plan);
  const before = clone(empty);
  assert.equal(empty.results.length, plan.pairs.length);
  assert.ok(empty.results.every(r => r.status === 'untested' && r.note === ''));
  let current = empty;
  for (const [i, status] of ['pass', 'fail', 'skipped', 'untested'].entries()) {
    const id = plan.pairs[i].id;
    current = setResult(current, id, status, `note ${i}`);
    assert.deepEqual(current.results.find(r => r.pairId === id), { pairId: id, status, note: `note ${i}` });
  }
  assert.deepEqual(empty, before, 'setResult is immutable');
  assert.deepEqual(validateSession(clone(current)), current);
});

const invalidSessionCases = [
  ['unknown schema', s => { s.schema = 'probeplan.session.v999'; }],
  ['missing binding', s => { delete s.binding; }],
  ['different binding', s => { s.binding += 'tampered'; }],
  ['changed map title', s => { s.map.title += ' edited'; }],
  ['changed connector label', s => { s.map.connectors[0].label += ' edited'; }],
  ['changed net name', s => { s.map.nets[0].id += '-edited'; }],
  ['missing result', s => { s.results.pop(); }],
  ['extra duplicate result', s => { s.results.push(clone(s.results[0])); }],
  ['same-count duplicate result', s => { s.results[1] = clone(s.results[0]); }],
  ['unknown pair ID', s => { s.results[0].pairId = 'unknown'; }],
  ['unknown status', s => { s.results[0].status = 'pending'; }],
  ['numeric note', s => { s.results[0].note = 42; }],
  ['missing note', s => { delete s.results[0].note; }],
  ['unknown result field', s => { s.results[0].mystery = true; }],
  ['unknown session field', s => { s.mystery = true; }],
];
for (const [name, mutate] of invalidSessionCases) {
  test(`strict session: reject ${name}`, () => {
    const session = createSession(compile(fixture()));
    mutate(session);
    assert.throws(() => validateSession(session));
  });
}

test('setResult rejects unknown pair IDs, status values, and non-string notes', () => {
  const plan = compile(fixture());
  const session = createSession(plan);
  assert.throws(() => setResult(session, 'unknown', 'pass', ''));
  assert.throws(() => setResult(session, plan.pairs[0].id, 'pending', ''));
  assert.throws(() => setResult(session, plan.pairs[0].id, 'pass', 42));
});


test('canonical binding is invariant to object fields and unordered map arrays', () => {
  const original = fixture();
  const reordered = {
    unused: original.unused.toReversed().map(p => ({ pin: p.pin, connector: p.connector })),
    nets: original.nets.toReversed().map(n => ({ pins: n.pins.toReversed(), id: n.id })),
    connectors: original.connectors.toReversed().map(c => ({ pins: c.pins.toReversed(), label: c.label, id: c.id })),
    title: original.title, schema: original.schema,
  };
  assert.deepEqual(compile(reordered), compile(original));
  const session = setResult(createSession(compile(original)), compile(original).pairs[0].id, 'pass', 'original result');
  assert.deepEqual(reconcileSession(session, reordered), { session, invalidated: false });
  const changed = clone(original);
  changed.connectors[0].label = 'New connector label';
  const reconciled = reconcileSession(session, changed);
  assert.equal(reconciled.invalidated, true);
  assert.ok(reconciled.session.results.every(result => result.status === 'untested' && result.note === ''));
});

test('topology changes invalidate every old result, even when pair IDs stay identical', () => {
  const original = fixture();
  const plan = compile(original);
  const session = setResult(createSession(plan), plan.pairs[0].id, 'pass', 'old topology');
  const changed = clone(original);
  const left = changed.nets[0].pins[1];
  changed.nets[0].pins[1] = changed.nets[1].pins[1];
  changed.nets[1].pins[1] = left;
  assert.deepEqual(compile(changed).pairs.map(p => p.id), plan.pairs.map(p => p.id));
  const reconciled = reconcileSession(session, changed);
  assert.equal(reconciled.invalidated, true);
  assert.ok(reconciled.session.results.every(result => result.status === 'untested' && result.note === ''));
  const tampered = clone(session);
  tampered.map = changed;
  assert.throws(() => validateSession(tampered));
});

test('strict JSON rejects duplicate keys, including escaped aliases and nested keys', () => {
  for (const text of [
    '{"a":1,"a":2}',
    String.raw`{"a":1,"\u0061":2}`,
    '{"outer":{"a":1,"a":2}}',
    '[{"a":1,"a":2}]',
    '{"__proto__":{},"__proto__":{}}',
  ]) assert.throws(() => parseStrictJSON(text), text);
});

test('strict JSON rejects invalid grammar and excessive nesting', () => {
  for (const text of [
    '', ' ', 'undefined', 'NaN', 'Infinity', '-Infinity', '+1', '01', '-01', '1.', '.5', '1e', '1e+', '1e999',
    'true false', 'nullx', '{}{}', '{a:1}', '{"a":}', '{"a":1,}', '[1,]', '[,1]', '[1 2]',
    '{"a" 1}', '{"a":1 "b":2}', '\"unterminated', String.raw`"bad\xescape"`,
    '"unescaped\nnewline"', '['.repeat(22) + '0' + ']'.repeat(22),
  ]) assert.throws(() => parseStrictJSON(text), JSON.stringify(text));
});

test('strict JSON agrees with native JSON parsing on valid scalar and nested values', () => {
  const values = [null, true, false, 0, -0, -12.75, 2.5e30, '', '"quote" \\ /', 'é 日本語 🔌',
    [1, false, null, { x: 'y' }], { '__proto__ safe key': [1, { constructor: 3 }] }];
  for (const value of values) {
    const text = JSON.stringify(value);
    assert.equal(JSON.stringify(parseStrictJSON(text)), text);
  }
});

test('display strings reject noncanonical, unsafe control and overlong values', () => {
  for (const title of ['', ' leading', 'trailing ', 'e\u0301', 'unsafe\u0000', 'unsafe\u202e', 'unsafe\u2066', '\ud800', 'x'.repeat(81)]) {
    const map = fixture(); map.title = title;
    assert.throws(() => compile(map), JSON.stringify(title));
  }
  const map = fixture(); map.title = '日本語 🔌 é';
  assert.equal(compile(map).map.title, map.title);
  const plan = compile(map), session = createSession(plan);
  assert.doesNotThrow(() => setResult(session, plan.pairs[0].id, 'pass', 'x'.repeat(240)));
  for (const note of ['x'.repeat(241), ' leading', 'trailing ', 'a\nb', '\udfff']) {
    assert.throws(() => setResult(session, plan.pairs[0].id, 'pass', note));
  }
});

test('prototype-like connector and net IDs remain distinct safe keys', () => {
  const map = {
    schema: 'probeplan.pinmap.v1', title: 'Safe property names',
    connectors: [
      { id: '__proto__', label: 'A', pins: ['1', '2'] },
      { id: 'constructor', label: 'B', pins: ['1', '2'] },
    ],
    nets: [{ id: 'toString', pins: [{ connector: '__proto__', pin: '1' }, { connector: 'constructor', pin: '1' }] }],
    unused: [{ connector: '__proto__', pin: '2' }, { connector: 'constructor', pin: '2' }],
  };
  const plan = compile(map);
  assert.equal(plan.pairs.length, 6);
  assert.equal(plan.pairs.filter(p => p.expected === 'connected').length, 1);
  assert.deepEqual(parseSession(JSON.stringify(createSession(plan))), createSession(plan));
});

test('pair IDs cannot collide when pin names contain endpoint delimiters', () => {
  const pins = ['x,y', 'x:y', 'x/y', 'x"y', 'x\\y'];
  const map = {
    schema: 'probeplan.pinmap.v1', title: 'Escaped pin names',
    connectors: [{ id: 'A', label: 'A', pins }], nets: [],
    unused: pins.map(pin => ({ connector: 'A', pin })),
  };
  const plan = compile(map);
  assert.equal(new Set(plan.pairs.map(p => p.id)).size, 10);
  assert.deepEqual(parseSession(JSON.stringify(createSession(plan))), createSession(plan));
});

test('every permitted maximum-sized session can be imported again', () => {
  const map = mapFor(Array.from({ length: 32 }, (_, i) => i));
  const session = createSession(compile(map));
  session.results.forEach(result => { result.status = 'pass'; result.note = '日'.repeat(240); });
  const valid = validateSession(session);
  assert.deepEqual(parseSession(JSON.stringify(valid, null, 2)), valid);
});

// CSV parser independent of production escaping: fully quoted fields may contain
// separators, escaped quotes, and line breaks. A closing quote must be followed
// by a separator or CRLF, so malformed escaping cannot silently look correct.
function readCSV(text) {
  const rows = []; let row = []; let i = 0;
  while (i < text.length) {
    assert.equal(text[i++], '"', 'each CSV field starts with a quote');
    let value = ''; let closed = false;
    while (i < text.length) {
      if (text[i] === '"') {
        if (text[i + 1] === '"') { value += '"'; i += 2; }
        else { i++; closed = true; break; }
      } else value += text[i++];
    }
    assert.equal(closed, true, 'CSV field must be closed');
    row.push(value);
    if (text[i] === ',') i++;
    else {
      assert.equal(text.slice(i, i + 2), '\r\n', 'CSV rows use CRLF');
      i += 2; rows.push(row); row = [];
    }
  }
  assert.equal(row.length, 0);
  return rows;
}
function hostileSession() {
  const title = '<script>alert("title")</script> & 日本語';
  const label = '</text><svg onload="alert(1)"> & 日本語';
  const pins = ['<svg onload="x">', '&"pin\'2'];
  const map = {
    schema: 'probeplan.pinmap.v1', title,
    connectors: [{ id: 'A', label, pins }], nets: [],
    unused: pins.map(pin => ({ connector: 'A', pin })),
  };
  const plan = compile(map);
  return setResult(createSession(plan), plan.pairs[0].id, 'fail', '</td><script>alert("note")</script> & 日本語');
}
function assertNoActiveMarkup(markup) {
  assert.doesNotMatch(markup, /<(?:script|iframe|object|embed|foreignObject)\b/i);
  for (const tag of markup.match(/<[^>]+>/g) ?? []) {
    assert.doesNotMatch(tag, /\son[a-z]+\s*=/i, `event handler in ${tag}`);
    assert.doesNotMatch(tag, /\b(?:href|src)\s*=/i, `external reference in ${tag}`);
  }
}

test('JSON, CSV, SVG, and HTML exports escape hostile text without losing saved records', async () => {
  const { toJSON, toCSV, toSVG, toHTML } = await import('../src/export.mjs');
  const session = hostileSession();
  assert.deepEqual(parseSession(toJSON(session)), session);
  const rows = readCSV(toCSV(session));
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.length === 11));
  assert.equal(rows[1][0], session.map.title);
  assert.equal(rows[1][8], 'fail');
  assert.equal(rows[1][9], session.results[0].note);
  for (const language of ['en', 'ja']) {
    const svg = toSVG(session, language);
    const html = toHTML(session, language);
    for (const markup of [svg, html]) {
      assertNoActiveMarkup(markup);
      assert.ok(markup.includes('&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt; &amp; 日本語'));
      assert.ok(markup.includes('&lt;/text&gt;&lt;svg onload=&quot;alert(1)&quot;&gt; &amp; 日本語'));
      assert.ok(markup.includes('&lt;svg onload=&quot;x&quot;&gt;'));
      assert.ok(markup.includes('&amp;&quot;pin&#39;2'));
    }
    assert.ok(html.includes('&lt;/td&gt;&lt;script&gt;alert(&quot;note&quot;)&lt;/script&gt; &amp; 日本語'));
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /default-src 'none'/);
    assert.equal((html.match(/<tbody>/g) ?? []).length, 1);
  }
});

test('CSV formula prefixes are inert and commas/quotes stay in one cell', async () => {
  const { toCSV, escapeCSV } = await import('../src/export.mjs');
  for (const prefix of ['=', '+', '-', '@']) {
    const pins = [`${prefix}pin,1`, '2'];
    const map = {
      schema: 'probeplan.pinmap.v1', title: `${prefix}title,"quoted"`,
      connectors: [{ id: 'A', label: 'A', pins }], nets: [],
      unused: pins.map(pin => ({ connector: 'A', pin })),
    };
    const plan = compile(map);
    const session = setResult(createSession(plan), plan.pairs[0].id, 'pass', `${prefix}note,"quoted"`);
    const rows = readCSV(toCSV(session));
    assert.equal(rows[1][0], `'${map.title}`);
    assert.equal(rows[1][9], `'${prefix}note,"quoted"`);
    assert.ok([rows[1][4], rows[1][6]].includes(`'${prefix}pin,1`));
  }
  const cells = ['comma,value', 'double"quote', 'line\nbreak', 'CR\rreturn', '\t=SUM(1,2)', '  +1'];
  assert.deepEqual(readCSV(cells.map(escapeCSV).join(',') + '\r\n')[0],
    ['comma,value', 'double"quote', 'line\nbreak', 'CR\rreturn', "'\t=SUM(1,2)", "'  +1"]);
});

test('every exporter refuses stale or structurally tampered session data', async () => {
  const exporters = await import('../src/export.mjs');
  for (const name of ['toJSON', 'toCSV', 'toSVG', 'toHTML']) {
    const session = createSession(compile(fixture()));
    session.map.title = 'Stale binding';
    assert.throws(() => exporters[name](session), `${name} must validate binding`);
    const malformed = createSession(compile(fixture()));
    malformed.results[0].status = '<script>';
    assert.throws(() => exporters[name](malformed), `${name} must validate result shape`);
  }
});

test('SVG output contains only XML 1.0 legal characters for every accepted title', async () => {
  const { toSVG } = await import('../src/export.mjs');
  for (const char of ['\ufffe', '\uffff']) {
    const map = fixture(); map.title = `bad${char}`;
    let plan;
    try { plan = compile(map); } catch { continue; }
    const svg = toSVG(createSession(plan));
    assert.doesNotMatch(svg, /[\ufffe\uffff]/u, 'SVG cannot contain XML-forbidden BMP noncharacters');
  }
});

test('unknown export languages safely use English including prototype-like names', async () => {
  const { toSVG, toHTML } = await import('../src/export.mjs');
  const session = createSession(compile(fixture()));
  for (const language of ['unknown', '__proto__', 'constructor', 'toString']) {
    assert.equal(toSVG(session, language), toSVG(session, 'en'));
    assert.equal(toHTML(session, language), toHTML(session, 'en'));
  }
});

test('worst-case-style Unicode and escape-heavy full session survives actual JSON export', async () => {
  const { toJSON } = await import('../src/export.mjs');
  const map = {
    schema: 'probeplan.pinmap.v1', title: '日'.repeat(80),
    connectors: Array.from({ length: 32 }, (_, i) => ({ id: String(i).padEnd(24, 'A'), label: '日'.repeat(48), pins: ['"'.repeat(24)] })),
    nets: [], unused: [],
  };
  map.unused = map.connectors.map(c => ({ connector: c.id, pin: c.pins[0] }));
  const session = createSession(compile(map));
  session.results.forEach(result => { result.status = 'skipped'; result.note = '日'.repeat(240); });
  const text = toJSON(session);
  assert.ok(new TextEncoder().encode(text).length > 500_000, 'exercise a large multibyte artifact');
  assert.deepEqual(parseSession(text), session);
});
