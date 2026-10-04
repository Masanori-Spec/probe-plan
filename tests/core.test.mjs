import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {branch,straight} from '../src/examples.mjs';import {compile,createSession,setResult,parseStrictJSON,parseMap,reconcileSession} from '../src/core.mjs';import {rowsToMap,mapToRows} from '../src/table.mjs';import {toJSON,toCSV,toHTML,toSVG} from '../src/export.mjs';
for(const [name,map] of Object.entries({branch,straight})){
 test(`${name}: table/model/example JSON agree`,async()=>{const normalized=compile(map).map;assert.deepEqual(rowsToMap(map.title,mapToRows(map)),normalized);assert.deepEqual(parseMap(await readFile(`examples/${name}.json`,'utf8')),normalized);});
 test(`${name}: deterministic exports`,()=>{const session=createSession(compile(map));for(const fn of [toJSON,toCSV,toHTML,toSVG])assert.equal(fn(session),fn(structuredClone(session)));});
}
test('table rejects inconsistent connector descriptions',()=>{const rows=mapToRows(branch);rows[1].label='different';assert.throws(()=>rowsToMap(branch.title,rows),/same label/);});
test('table rejects missing assignments and duplicate pin rows',()=>{const rows=mapToRows(branch);rows[0].net='';assert.throws(()=>rowsToMap(branch.title,rows));const valid=mapToRows(branch);valid.push(valid[0]);assert.throws(()=>rowsToMap(branch.title,valid),/duplicate pin/);});
test('table explicit unused pins remain distinct',()=>{const map=rowsToMap('Unused',[{connector:'C',label:'C',pin:'1',net:'-'},{connector:'C',label:'C',pin:'2',net:'-'}]);assert.equal(compile(map).pairs[0].expected,'not-connected');});
test('result snapshot is not a cryptographic attestation',()=>{let s=createSession(compile(straight));s=setResult(s,s.results[0].pairId,'pass','Recorded by a person');const json=toJSON(s);assert.match(json,/Recorded by a person/);assert.match(toHTML(s),/User-recorded results only/);assert.match(toSVG(s),/No measured evidence/);});
test('metadata changes conservatively invalidate results',()=>{let s=createSession(compile(straight));s=setResult(s,s.results[0].pairId,'pass','');const changed=structuredClone(straight);changed.title='Different title';assert.equal(reconcileSession(s,changed).invalidated,true);});
test('short pin symbols cannot collide with unused marker',()=>{const rows=mapToRows(straight);rows[0].pin='-';const m=rowsToMap(straight.title,rows);assert.ok(m.connectors[0].pins.includes('-'));assert.equal(compile(m).pairs.length,6);});
test('strict JSON uses a UTF-8 byte boundary',()=>{assert.throws(()=>parseStrictJSON('"'+'あ'.repeat(333334)+'"'),/bytes/);});
test('both languages include scope and result provenance',()=>{for(const lang of ['en','ja']){const s=createSession(compile(branch));assert.match(toHTML(s,lang),lang==='en'?/No mains, batteries/:/商用電源/);assert.match(toHTML(s,lang),lang==='en'?/User pass/:/手入力：一致/);}});
test('long CJK pin references fit their SVG column without losing data',()=>{const m=structuredClone(straight);const pin='端'.repeat(24);m.connectors[0].pins[0]=pin;m.nets[0].pins[0].pin=pin;const svg=toSVG(createSession(compile(m)));assert.ok(svg.includes(`data-fit-width="165">${pin}`));});

test('reserved table marker cannot be a JSON net ID',()=>{const m=structuredClone(straight);m.nets[0].id='-';assert.throws(()=>compile(m),/reserved/);});

for(const [name,mutate] of Object.entries({
  connectors:m=>{m.connectors.length++;},
  connectorPins:m=>{m.connectors[0].pins.length++;},
  nets:m=>{m.nets.length++;},
  netPins:m=>{m.nets[0].pins.length++;},
  unused:m=>{m.unused.length++;},
  interiorPins:m=>{delete m.connectors[0].pins[0];},
  singleRealPinNet:m=>{delete m.nets[0].pins[1];}
}))test(`sparse array rejected: ${name}`,()=>{const map=structuredClone(straight);mutate(map);assert.throws(()=>compile(map),/sparse/);});
test('sparse session result array rejected',()=>{const s=createSession(compile(straight));delete s.results[2];assert.throws(()=>toJSON(s),/sparse/);});
test('SVG-specific accessible IDs cannot collide with the app title input',()=>{const svg=toSVG(createSession(compile(straight)));assert.match(svg,/aria-labelledby="probeplan-reference-title probeplan-reference-desc"/);assert.ok(!svg.includes('id="title"'));});
test('wide ASCII titles, descriptions, pins and net IDs fit dedicated columns',()=>{const map=structuredClone(straight);map.title='W'.repeat(60);map.connectors[0].label='W'.repeat(40);map.connectors[0].pins[0]='W'.repeat(20);map.nets[0].pins[0].pin='W'.repeat(20);map.nets[0].id='W'.repeat(24);const svg=toSVG(createSession(compile(map)));for(const [width,length] of [[936,60],[410,40],[165,20],[188,24]])assert.ok(svg.includes(`data-fit-width="${width}">${'W'.repeat(length)}`));});

test('ordinary SVG labels retain their original font size instead of widening',()=>{const svg=toSVG(createSession(compile(straight)));assert.match(svg,/font-size="12.000" data-fit-width="410">End A/);assert.ok(!svg.includes('textLength='));});
