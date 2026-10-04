/** Event/state regressions using a minimal DOM stub. These do not replace browser tests. */
import test from 'node:test';import assert from 'node:assert/strict';import {branch,straight} from '../src/examples.mjs';import {compile,createSession} from '../src/core.mjs';
let run=0;
async function boot(){
 const nodes=new Map();
 class Element{
  constructor(id){this.id=id;this.value=id==='filter'?'all':'';this.listeners=new Map();this.innerHTML='';this.textContent='';this.dataset={};this.checked=false;this.hidden=false;this.disabled=false;this.returnValue='';}
  addEventListener(type,fn){this.listeners.set(type,fn);}setAttribute(){}focus(){}querySelector(){return new Element('stub');}showModal(){}
 }
 globalThis.document={documentElement:{lang:''},getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);},querySelectorAll:()=>[]};
 globalThis.window={addEventListener(){}};
 const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 await import(`../src/app.mjs?state-regression=${++run}`);
 const event=(id,type,target={})=>nodes.get(id).listeners.get(type)({target});
 const pairCount=()=>Number(nodes.get('stats').innerHTML.match(/<b>(\d+)<\/b>/)[1]);
 const startRead=()=>{let resolve,reject;const text=new Promise((yes,no)=>{resolve=yes;reject=no;});const pending=event('file','change',{files:[{size:100,text:()=>text}],value:'pending.json'});return {resolve,reject,pending};};
 const record=(index,status)=>event('checklist','change',{dataset:{result:String(index)},value:status,closest:()=>({className:''})});
 const confirm=async()=>{const dialog=nodes.get('confirm-dialog');dialog.returnValue='confirm';await dialog.listeners.get('close')();};
 return {nodes,saved,event,pairCount,startRead,record,confirm};
}
test('delayed import cannot replace a newer sample',async()=>{const h=await boot(),old=h.startRead();await h.event('sample','change',{value:'straight'});assert.equal(h.pairCount(),6);old.resolve(JSON.stringify(branch));await old.pending;assert.equal(h.pairCount(),6);});
test('delayed import cannot replace a newer manual record',async()=>{const h=await boot(),old=h.startRead();h.event('ack','change',{checked:true});h.record(0,'pass');old.resolve(JSON.stringify(straight));await old.pending;assert.equal(h.pairCount(),21);assert.match(h.nodes.get('progress-count').textContent,/1 \/ 21/);});
test('delayed import cannot replace a newer restore',async()=>{const h=await boot(),old=h.startRead();h.saved.set('probeplan.session.v1',JSON.stringify(createSession(compile(straight))));await h.event('restore','click');old.resolve(JSON.stringify(branch));await old.pending;assert.equal(h.pairCount(),6);});
test('delayed import cannot replace a newer confirmed reset',async()=>{const h=await boot();h.event('ack','change',{checked:true});h.record(0,'fail');const old=h.startRead(),reset=h.event('reset','click');await h.confirm();await reset;old.resolve(JSON.stringify(straight));await old.pending;assert.equal(h.pairCount(),21);assert.match(h.nodes.get('progress-count').textContent,/0 \/ 21/);});
test('superseded import errors cannot overwrite the current notice',async()=>{const h=await boot(),old=h.startRead();await h.event('sample','change',{value:'straight'});const notice=h.nodes.get('notice').textContent;old.reject(new Error('old failed read'));await old.pending;assert.equal(h.nodes.get('notice').textContent,notice);});
test('active pending and problem filters update their cards and counts',async()=>{const h=await boot();h.event('ack','change',{checked:true});h.nodes.get('filter').value='pending';h.event('filter','change');h.record(0,'pass');assert.equal((h.nodes.get('checklist').innerHTML.match(/data-pair-card=/g)||[]).length,20);assert.match(h.nodes.get('showing').textContent,/20 \/ 21/);h.nodes.get('filter').value='all';h.event('filter','change');h.record(1,'fail');h.nodes.get('filter').value='problem';h.event('filter','change');assert.match(h.nodes.get('showing').textContent,/1 \/ 21/);h.record(1,'pass');assert.match(h.nodes.get('showing').textContent,/0 \/ 21/);});
test('unapplied edits remain visible in screen-print state',async()=>{const h=await boot();h.event('title','input',{value:'Edited'});assert.match(h.nodes.get('print-state').textContent,/未反映/);});
