/** Pure model. No I/O, clocks, random values, measurements or hardware access. */
export const MAX_PINS = 32;
export const MAX_INPUT_BYTES = 1_000_000;
export const STATUSES = Object.freeze(['untested', 'pass', 'fail', 'skipped']);
export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}
const fail = message => { throw new ValidationError(message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const keys = (value, expected, path) => {
  if (!plain(value)) fail(`${path}: expected an object`);
  if (Object.keys(value).sort().join('\0') !== [...expected].sort().join('\0')) fail(`${path}: required keys are ${expected.join(', ')}; unknown keys are not accepted`);
};
const string = (value, path, max, allowEmpty = false) => {
  if (typeof value !== 'string' || value !== value.trim() || value !== value.normalize('NFC') || value.length > max || (!allowEmpty && value.length === 0) || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ud800-\udfff\ufffe\uffff]/u.test(value)) fail(`${path}: use ${allowEmpty ? '0' : '1'}–${max} characters, NFC, no surrounding whitespace or control characters`);
  return value;
};
const id = (v, p) => { string(v, p, 24); if (!/^[A-Za-z0-9_-]+$/.test(v)) fail(`${p}: use only A–Z, a–z, 0–9, _ or -`); return v; };
const array = (v, p, max) => { if (!Array.isArray(v) || v.length > max) fail(`${p}: expected an array of at most ${max} items`); for(let i=0;i<v.length;i++) if(!Object.hasOwn(v,i)) fail(`${p}: sparse arrays are not accepted`); return v; };
const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
export const pinKey = p => JSON.stringify([p.connector,p.pin]);
export const pairKey = (a,b) => JSON.stringify([a.connector,a.pin,b.connector,b.pin]);
const pinCompare = (a,b) => cmp(a.connector,b.connector) || cmp(a.pin,b.pin);
/** Strict JSON parser: duplicate object keys (including escaped spellings) are errors. */
export function parseStrictJSON(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_INPUT_BYTES) fail('JSON: file exceeds 1,000,000 bytes');
  let i = 0;
  const ws = () => { while (/[\t\n\r ]/.test(text[i] ?? '\uffff')) i++; };
  const str = () => {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i++] === '"') { try { return JSON.parse(text.slice(start,i)); } catch { fail(`JSON: invalid string near character ${start + 1}`); } }
    }
    fail('JSON: unterminated string');
  };
  const value = depth => {
    if (depth > 20) fail('JSON: nesting exceeds 20 levels');
    ws(); const c = text[i];
    if (c === '"') return str();
    if (c === '{') {
      i++; ws(); const out = Object.create(null); const seen = new Set();
      if (text[i] === '}') { i++; return out; }
      while (true) {
        ws(); if (text[i] !== '"') fail(`JSON: expected a key near character ${i+1}`);
        const k = str(); if (seen.has(k)) fail(`JSON: duplicate key ${k}`); seen.add(k);
        ws(); if (text[i++] !== ':') fail('JSON: expected colon'); out[k] = value(depth+1); ws();
        if (text[i] === '}') { i++; return out; } if (text[i++] !== ',') fail('JSON: expected comma');
      }
    }
    if (c === '[') {
      i++; ws(); const out = []; if (text[i] === ']') { i++; return out; }
      while (true) { out.push(value(depth+1)); ws(); if (text[i] === ']') { i++; return out; } if (text[i++] !== ',') fail('JSON: expected comma'); }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!token) fail(`JSON: invalid value near character ${i+1}`);
    i += token[0].length; const parsed = JSON.parse(token[0]); if (typeof parsed === 'number' && !Number.isFinite(parsed)) fail('JSON: non-finite number'); return parsed;
  };
  const result = value(0); ws(); if (i !== text.length) fail(`JSON: trailing content near character ${i+1}`); return result;
}
export function normalizeMap(input) {
  keys(input,['schema','title','connectors','nets','unused'],'map');
  if (input.schema !== 'probeplan.pinmap.v1') fail('map.schema: expected probeplan.pinmap.v1');
  const title = string(input.title,'map.title',80);
  const declared = new Set(); const connectorIds = new Set();
  const connectors = array(input.connectors,'connectors',32).map((c,n) => {
    keys(c,['id','label','pins'],`connectors[${n}]`); id(c.id,`connectors[${n}].id`); string(c.label,`connectors[${n}].label`,48);
    if (connectorIds.has(c.id)) fail(`connectors: duplicate ID ${c.id}`); connectorIds.add(c.id);
    const pins = array(c.pins,`connector ${c.id}.pins`,32).map(p => {
      string(p,`connector ${c.id} pin`,24); const k=pinKey({connector:c.id,pin:p});
      if(declared.has(k)) fail(`connector ${c.id}: duplicate pin ${p}`); declared.add(k); return p;
    }).sort(cmp);
    if (!pins.length) fail(`connector ${c.id}: at least one pin is required`);
    return {id:c.id,label:c.label,pins};
  }).sort((a,b)=>cmp(a.id,b.id));
  if(declared.size < 2 || declared.size > MAX_PINS) fail('map: declare 2–32 total pins');
  const assigned = new Set(); const netIds = new Set();
  const ref = (p,path) => {
    keys(p,['connector','pin'],path); id(p.connector,`${path}.connector`); string(p.pin,`${path}.pin`,24);
    const k = pinKey(p); if(!declared.has(k)) fail(`${path}: undeclared pin ${p.connector}/${p.pin}`);
    if(assigned.has(k)) fail(`${path}: pin ${p.connector}/${p.pin} assigned more than once`); assigned.add(k);
    return {connector:p.connector,pin:p.pin};
  };
  const nets = array(input.nets,'nets',32).map((n,i)=>{
    keys(n,['id','pins'],`nets[${i}]`); id(n.id,`nets[${i}].id`); if(n.id==='-') fail('net ID - is reserved for isolated pins in the table editor'); if(netIds.has(n.id)) fail(`nets: duplicate ID ${n.id}`); netIds.add(n.id);
    const pins = array(n.pins,`net ${n.id}.pins`,32).map((p,j)=>ref(p,`net ${n.id} pin ${j+1}`)).sort(pinCompare);
    if(pins.length < 2) fail(`net ${n.id}: at least two pins required; use unused for an isolated pin`);
    return {id:n.id,pins};
  }).sort((a,b)=>cmp(a.id,b.id));
  const unused = array(input.unused,'unused',32).map((p,i)=>ref(p,`unused[${i}]`)).sort(pinCompare);
  if(assigned.size !== declared.size) fail(`map: ${declared.size-assigned.size} declared pin(s) missing a net or explicit unused assignment`);
  return {schema:'probeplan.pinmap.v1',title,connectors,nets,unused};
}
export const parseMap = text => normalizeMap(parseStrictJSON(text));
export function compile(input) {
  const map = normalizeMap(input); const binding = JSON.stringify(map);
  const pins = map.connectors.flatMap(c=>c.pins.map(pin=>({connector:c.id,pin})));
  const membership = new Map(map.nets.flatMap(n=>n.pins.map(p=>[pinKey(p),n.id])));
  const pairs = [];
  for(let i=0;i<pins.length;i++) for(let j=i+1;j<pins.length;j++) {
    const a=pins[i],b=pins[j],net=membership.get(pinKey(a));
    pairs.push({id:pairKey(a,b),a,b,expected:net !== undefined && net === membership.get(pinKey(b)) ? 'connected':'not-connected'});
  }
  return {map,binding,pairs};
}
export const createSession = plan => {
  const checked = compile(plan.map); if(plan.binding!==checked.binding) fail('plan: binding mismatch');
  return {schema:'probeplan.session.v1',map:checked.map,binding:checked.binding,results:checked.pairs.map(p=>({pairId:p.id,status:'untested',note:''}))};
};
export function validateSession(input) {
  keys(input,['schema','map','binding','results'],'session');
  if(input.schema !== 'probeplan.session.v1') fail('session.schema: expected probeplan.session.v1');
  const plan = compile(input.map); if(input.binding !== plan.binding) fail('session: pin-map binding mismatch; records cannot be reused');
  array(input.results,'results',496); if(input.results.length !== plan.pairs.length) fail('session: each pair must have exactly one record');
  const found = new Map(); const expected = new Set(plan.pairs.map(p=>p.id));
  for(const r of input.results) {
    keys(r,['pairId','status','note'],'result'); if(typeof r.pairId !== 'string' || !expected.has(r.pairId) || found.has(r.pairId)) fail('result: unknown or repeated pair ID');
    if(!STATUSES.includes(r.status)) fail('result: unknown status'); string(r.note,'result.note',240,true); found.set(r.pairId,{pairId:r.pairId,status:r.status,note:r.note});
  }
  return {schema:'probeplan.session.v1',map:plan.map,binding:plan.binding,results:plan.pairs.map(p=>found.get(p.id))};
}
export const parseSession = text => validateSession(parseStrictJSON(text));
export function setResult(input,pairId,status,note='') {
  const session = validateSession(input); if(!STATUSES.includes(status)) fail('result: unknown status'); string(note,'result.note',240,true);
  const result = session.results.find(r=>r.pairId===pairId); if(!result) fail('result: unknown pair ID');
  result.status=status; result.note=note; return session;
}
export function reconcileSession(input,map) {
  const old = validateSession(input), plan = compile(map), changed=old.binding!==plan.binding;
  return {session:changed ? createSession(plan):old,invalidated:changed};
}
export function summarize(input) {
  const s=validateSession(input); const counts={untested:0,pass:0,fail:0,skipped:0}; s.results.forEach(r=>counts[r.status]++);
  return {...counts,total:s.results.length,recorded:s.results.length-counts.untested};
}
/** Short visual reference only. Integrity uses the complete canonical binding, never this non-cryptographic mark. */
export function referenceCode(binding) { let hash=2166136261; for(const c of binding) { hash^=c.charCodeAt(0); hash=Math.imul(hash,16777619); } return (hash>>>0).toString(16).padStart(8,'0').toUpperCase(); }
