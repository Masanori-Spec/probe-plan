import {compile,createSession,parseStrictJSON,parseMap,validateSession,reconcileSession,setResult,summarize,referenceCode,MAX_INPUT_BYTES} from './core.mjs';
import {mapToRows,rowsToMap} from './table.mjs';
import {toJSON,toCSV,toHTML,toSVG,escapeMarkup as e} from './export.mjs';
import {branch,straight} from './examples.mjs';
import {copy} from './i18n.mjs';
const $=id=>document.getElementById(id), storageKey='probeplan.session.v1';
let lang='ja', mode='table', session=createSession(compile(branch)), rows=mapToRows(branch), draftText=JSON.stringify(session.map,null,2), title=session.map.title;
let dirty=false, acknowledged=false, unsaved=false, importGeneration=0, modalOpen=false;
const t=()=>copy[lang];
function notify(message,isError=false){$('notice').textContent=message;$('notice').className=isError?'notice error':'notice';$('notice').setAttribute('role',isError?'alert':'status');}
function savedExists(){try{return localStorage.getItem(storageKey)!==null;}catch{return false;}}
function summary(){
  const s=summarize(session),p=compile(session.map),n=p.map.connectors.reduce((n,c)=>n+c.pins.length,0),connected=p.pairs.filter(p=>p.expected==='connected').length;
  $('stats').innerHTML=`<div class="stat main-stat"><b>${s.total}</b><span>${e(t().pairs)}</span></div><div class="stat"><b>${connected}</b><span>${e(t().connected)}</span></div><div class="stat"><b>${s.total-connected}</b><span>${e(t().notConnected)}</span></div><div class="stat"><b>${n}</b><span>${e(t().pins)}</span></div>`;
  $('progress-count').textContent=`${s.recorded} / ${s.total} ${t().records}`;$('progress').value=s.recorded;$('progress').max=s.total;
  $('status-counts').innerHTML=['untested','pass','fail','skipped'].map(k=>`<span class="count ${k}">${e(t()[k])} <b>${s[k]}</b></span>`).join('');
  $('map-ref').textContent=`${t().mapRef} ${referenceCode(session.binding)}`;
}
function refreshLock(){
  const locked=dirty||!acknowledged;
  $('dirty').hidden=!dirty;
  $('print-state').textContent=dirty?t().dirty:t().ready;
  document.querySelectorAll('[data-locked]').forEach(el=>el.disabled=locked);
  $('compile').disabled=false;
  $('add').disabled=rows.length>=32;
}
function markDirty(){importGeneration++;dirty=true;unsaved=true;refreshLock();}
function renderRows(){
  $('pin-rows').innerHTML=rows.map((r,i)=>`<tr><td><span class="row-number">${i+1}</span><input data-field="connector" data-row="${i}" aria-label="${e(t().connector)} ${i+1}" value="${e(r.connector)}" maxlength="24" spellcheck="false"></td><td><input data-field="label" data-row="${i}" aria-label="${e(t().label)} ${i+1}" value="${e(r.label)}" maxlength="48"></td><td><input data-field="pin" data-row="${i}" aria-label="${e(t().pin)} ${i+1}" value="${e(r.pin)}" maxlength="24" spellcheck="false"></td><td><input data-field="net" data-row="${i}" aria-label="${e(t().net)} ${i+1}" value="${e(r.net)}" maxlength="24" spellcheck="false"></td><td><button class="icon-btn" data-remove="${i}" aria-label="${e(t().remove)} ${i+1}">×</button></td></tr>`).join('');
}
function renderChecklist(){
  const p=compile(session.map),filter=$('filter').value,query=$('search').value.toLocaleLowerCase().trim(),records=new Map(session.results.map(r=>[r.pairId,r]));
  const list=p.pairs.map((pair,index)=>({pair,index,r:records.get(pair.id)})).filter(({pair,r})=>{
    if(filter==='connected'&&pair.expected!=='connected')return false;
    if(filter==='not-connected'&&pair.expected!=='not-connected')return false;
    if(filter==='pending'&&r.status!=='untested')return false;
    if(filter==='problem'&&!['fail','skipped'].includes(r.status))return false;
    const haystack=`${pair.a.connector} / ${pair.a.pin} ${pair.b.connector} / ${pair.b.pin}`.toLocaleLowerCase();
    return !query||haystack.includes(query);
  });
  $('showing').textContent=`${t().showing} ${list.length} / ${p.pairs.length}`;
  $('checklist').innerHTML=list.map(({pair,index,r})=>`<article class="pair-card ${r.status}" data-pair-card="${index}"><div class="pair-top"><span class="pair-number">${String(index+1).padStart(3,'0')}</span><div class="pair-terminals"><span><b>${e(pair.a.connector)}</b><span class="pin-token">${e(pair.a.pin)}</span></span><span class="pair-link" aria-hidden="true">${pair.expected==='connected'?'↔':'⋯'}</span><span><b>${e(pair.b.connector)}</b><span class="pin-token">${e(pair.b.pin)}</span></span></div><span class="expect ${pair.expected}">${e(pair.expected==='connected'?t().connected:t().notConnected)}</span></div><div class="record-fields"><label>${e(t().result)}<select data-result="${index}" data-locked aria-label="${e(t().recordFor)} ${index+1}">${['untested','pass','fail','skipped'].map(v=>`<option value="${v}"${v===r.status?' selected':''}>${e(t()[v])}</option>`).join('')}</select></label><label>${e(t().note)}<input data-note="${index}" data-locked aria-label="${e(t().noteFor)} ${index+1}" value="${e(r.note)}" maxlength="240" placeholder="${e(t().notePlaceholder)}"></label></div></article>`).join('')||`<div class="empty">${e(t().noMatches)}</div>`;
  refreshLock();
}
function render(){
  document.documentElement.lang=lang;
  $('app').innerHTML=`<header class="topbar"><a class="brand" href="#" aria-label="ProbePlan home"><span class="brand-icon" aria-hidden="true">↔</span>ProbePlan<span class="beta">v0.1</span></a><div class="top-actions"><span class="local"><i></i>${e(t().local)}</span><div class="languages" aria-label="Language"><button data-lang="ja" aria-pressed="${lang==='ja'}">日本語</button><button data-lang="en" aria-pressed="${lang==='en'}">EN</button></div></div></header><main><aside class="screen-print-note"><strong>${e(t().screenPrint)}</strong><p id="print-state"></p></aside><section class="hero"><div><p class="eyebrow">${e(t().tag)}</p><h1>${t().hero.split('\n').map(e).join('<br>')}</h1><p class="lede">${e(t().lede)}</p></div><div class="hero-art" aria-hidden="true"><div class="art-top">CHECK KIT <span>01—21</span></div><div class="terminal-row"><span>J1 <i>01</i></span><b class="wire"></b><span>J2 <i>01</i></span></div><div class="terminal-row"><span>J1 <i>02</i></span><b class="wire dashed"></b><span>J2 <i>01</i></span></div><div class="art-bottom"><span>● EXPECTED</span><span>○ USER RECORDED</span></div></div></section><aside class="scope"><span class="scope-mark" aria-hidden="true">!</span><div><strong>${e(t().scope)}</strong><p>${e(t().scopeBody)}</p><p class="proof">${e(t().proof)}</p></div></aside><div id="notice" class="notice" role="status" aria-live="polite"></div><div class="workspace" id="workspace" tabindex="-1"><section class="editor panel"><div class="section-head"><p class="eyebrow">${e(t().step1)}</p><h2>${e(t().editorTitle)}</h2><p>${e(t().editorLead)}</p></div><div class="sample-bar"><label for="sample">${e(t().sample)}</label><select id="sample"><option value="">${e(t().sample)}…</option><option value="branch">${e(t().branch)}</option><option value="straight">${e(t().straight)}</option></select><button id="import" class="quiet">${e(t().import)}</button><input type="file" id="file" accept=".json,application/json" hidden aria-label="${e(t().choose)}"></div><p class="micro">${e(t().sampleHint)}</p><div class="tabs" role="group" aria-label="Editor"><button id="table-tab" aria-pressed="${mode==='table'}">${e(t().table)}</button><button id="json-tab" aria-pressed="${mode==='json'}">${e(t().json)}</button></div><div id="table-editor"${mode==='json'?' hidden':''}><label class="title-label" for="title">${e(t().title)}</label><input id="title" maxlength="80" value="${e(title)}"><div class="table-scroll"><table class="pin-table"><thead><tr><th>${e(t().connector)}</th><th>${e(t().label)}</th><th>${e(t().pin)}</th><th>${e(t().net)}</th><th><span class="sr-only">${e(t().remove)}</span></th></tr></thead><tbody id="pin-rows"></tbody></table></div><button id="add" class="quiet">＋ ${e(t().add)}</button><p class="micro">${e(t().tableHint)}</p></div><div id="json-editor"${mode==='table'?' hidden':''}><label class="sr-only" for="json-input">Pin map JSON</label><textarea id="json-input" spellcheck="false">${e(draftText)}</textarea><p class="micro">${e(t().jsonHint)}</p></div><button id="compile" class="primary">${e(t().compile)} <span aria-hidden="true">↗</span></button><p id="dirty" class="dirty"${dirty?'':' hidden'}>${e(t().dirty)}</p><details class="reference"><summary>${e(t().reference)}</summary><p>${e(t().referenceHelp)}</p><div id="reference"></div></details></section><section class="checks"><div class="section-head"><p class="eyebrow">${e(t().step2)}</p><h2>${e(t().recordTitle)}</h2><p>${e(t().recordLead)}</p></div><div id="stats" class="stats"></div><div class="record-summary"><div class="progress-head"><b id="progress-count"></b><small id="map-ref"></small></div><progress id="progress" value="0" max="1" aria-label="${e(t().records)}"></progress><div id="status-counts"></div><p class="micro">${e(t().summaryNote)}</p></div><label class="ack"><input type="checkbox" id="ack"${acknowledged?' checked':''}><span>${e(t().ack)}</span></label><p class="micro ack-help">${e(t().ackHelp)}</p><div class="filters"><label>${e(t().filter)}<select id="filter"><option value="all">${e(t().all)}</option><option value="connected">${e(t().connected)}</option><option value="not-connected">${e(t().notConnected)}</option><option value="pending">${e(t().pending)}</option><option value="problem">${e(t().problem)}</option></select></label><label>${e(t().search)}<input id="search" type="search" placeholder="${e(t().searchPlaceholder)}"></label></div><div class="list-caption"><span id="showing" aria-live="polite"></span><button id="reset" class="text-btn" data-locked>${e(t().reset)}</button></div><div id="checklist" class="checklist"></div></section></div><section class="takeaway panel"><div class="section-head"><p class="eyebrow">${e(t().step3)}</p><h2>${e(t().exports)}</h2><p>${e(t().exportLead)}</p></div><div class="exports">${[['json','{}','downloadJSON'],['html','↗','downloadHTML'],['csv','▦','downloadCSV'],['svg','◇','downloadSVG']].map(([ext,icon,key])=>`<button data-export="${ext}" data-locked><span aria-hidden="true">${icon}</span>${e(t()[key])}<small>.${ext}</small></button>`).join('')}</div><p class="micro">${e(t().exportHint)}</p><div class="storage"><div class="storage-actions"><button id="save" class="quiet" data-locked>${e(t().save)}</button><button id="restore" class="quiet"${savedExists()?'':' disabled'}>${e(t().restore)}</button><button id="forget" class="text-btn"${savedExists()?'':' disabled'}>${e(t().forget)}</button></div><p class="micro">${e(t().storageHint)}</p></div></section><section class="limitations"><h2>${e(t().limits)}</h2><p>${e(t().limitsBody)}</p><p>${e(t().privacy)}</p></section></main><footer><b>ProbePlan</b><span>${e(t().foot)}</span></footer><dialog id="confirm-dialog"><form method="dialog"><h2 id="dialog-title"></h2><p id="dialog-body"></p><div class="dialog-actions"><button value="cancel" class="quiet" autofocus>${e(t().cancel)}</button><button id="dialog-confirm" value="confirm" class="primary">${e(t().confirm)}</button></div></form></dialog>`;
  renderRows();summary();$('reference').innerHTML=toSVG(session,lang);renderChecklist();bind();
}
function currentMap(){return mode==='json'?parseMap(draftText):rowsToMap(title,rows);}
function setEditor(map){rows=mapToRows(map);title=map.title;draftText=JSON.stringify(map,null,2);dirty=false;}
function showError(error){notify(`${t().errorPrefix}: ${error.message}`,true);}
async function confirmAction(type='replace'){
  if(modalOpen)return false;modalOpen=true;
  const dialog=$('confirm-dialog');$('dialog-title').textContent=type==='reset'?t().resetTitle:type==='forget'?t().forgetTitle:t().dialogTitle;
  $('dialog-body').textContent=type==='reset'?t().resetBody:type==='forget'?t().forgetBody:t().dialogBody;
  $('dialog-confirm').textContent=type==='reset'?t().resetConfirm:type==='forget'?t().forgetConfirm:t().confirm;
  return new Promise(resolve=>{dialog.addEventListener('close',()=>{modalOpen=false;resolve(dialog.returnValue==='confirm');},{once:true});dialog.returnValue='cancel';dialog.showModal();});
}
const hasWork=()=>dirty||session.results.some(r=>r.status!=='untested'||r.note!=='');
async function replace(next,message,generation=++importGeneration){if(generation!==importGeneration)return false;if(hasWork()&&!await confirmAction())return false;if(generation!==importGeneration)return false;importGeneration++;session=validateSession(next);setEditor(session.map);acknowledged=false;unsaved=true;render();notify(message);return true;}
function download(ext){
  if(dirty||!acknowledged)return;
  const formats={json:['application/json',toJSON],csv:['text/csv',toCSV],svg:['image/svg+xml',toSVG],html:['text/html',toHTML]};
  const [mime,fn]=formats[ext],content=fn(session,lang),url=URL.createObjectURL(new Blob([content],{type:mime+';charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=`probeplan-${referenceCode(session.binding).toLowerCase()}.${ext}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);if(ext==='json')unsaved=false;notify(t().downloaded);
}
function bind(){
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{lang=button.dataset.lang;render();}));
  $('title').addEventListener('input',event=>{title=event.target.value;markDirty();});
  $('pin-rows').addEventListener('input',event=>{const el=event.target;if(el.dataset.field){rows[Number(el.dataset.row)][el.dataset.field]=el.value;markDirty();}});
  $('pin-rows').addEventListener('click',event=>{const el=event.target.closest('[data-remove]');if(!el)return;rows.splice(Number(el.dataset.remove),1);markDirty();renderRows();refreshLock();$('add').focus();});
  $('add').addEventListener('click',()=>{if(rows.length>=32)return;rows.push({connector:'',label:'',pin:'',net:'-'});markDirty();renderRows();refreshLock();$('pin-rows').querySelector(`input[data-row="${rows.length-1}"]`).focus();});
  $('json-input').addEventListener('input',event=>{draftText=event.target.value;markDirty();});
  for(const target of ['table','json'])$(`${target}-tab`).addEventListener('click',()=>{if(mode===target)return;try{const map=currentMap();setEditor(map);dirty=JSON.stringify(map)!==session.binding;mode=target;render();}catch(error){showError(error);}});
  $('compile').addEventListener('click',async()=>{
    try{const generation=++importGeneration,map=currentMap(),next=reconcileSession(session,map);if(next.invalidated&&hasWork()&&!await confirmAction())return;if(generation!==importGeneration)return;session=next.session;setEditor(session.map);unsaved=true;render();notify(next.invalidated?t().invalidated:t().unchanged);}catch(error){showError(error);}
  });
  $('ack').addEventListener('change',event=>{acknowledged=event.target.checked;refreshLock();});
  $('filter').addEventListener('change',renderChecklist);$('search').addEventListener('input',renderChecklist);
  $('checklist').addEventListener('input',()=>{importGeneration++;unsaved=true;});
  $('checklist').addEventListener('change',event=>{
    if(dirty||!acknowledged)return;const el=event.target,index=el.dataset.result??el.dataset.note;if(index===undefined)return;
    const p=compile(session.map).pairs[Number(index)],r=session.results[Number(index)];
    try{importGeneration++;session=setResult(session,p.id,el.dataset.result!==undefined?el.value:r.status,el.dataset.note!==undefined?el.value.trim():r.note);if(el.dataset.note!==undefined)el.value=el.value.trim();unsaved=true;summary();el.closest('.pair-card').className=`pair-card ${session.results[Number(index)].status}`;if(el.dataset.result!==undefined&&['pending','problem'].includes($('filter').value)){const focused=document.activeElement===el;renderChecklist();if(focused){const controls=[...document.querySelectorAll('[data-result]')];const target=controls.find(control=>Number(control.dataset.result)>=Number(index))??controls.at(-1)??$('filter');target.focus();}}}catch(error){showError(error);el.value=el.dataset.result!==undefined?r.status:r.note;}
  });
  $('reset').addEventListener('click',async()=>{if(dirty||!acknowledged)return;const generation=++importGeneration;if(!await confirmAction('reset')||generation!==importGeneration)return;session=createSession(compile(session.map));unsaved=true;summary();renderChecklist();notify(t().resetConfirm);});
  $('sample').addEventListener('change',async event=>{const value=event.target.value;if(!value)return;await replace(createSession(compile(value==='branch'?branch:straight)),t().loaded);if($('sample'))$('sample').value='';});
  $('import').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async event=>{
    const file=event.target.files?.[0],generation=++importGeneration;event.target.value='';if(!file)return;
    try{if(file.size>MAX_INPUT_BYTES)throw new Error('JSON: file exceeds 1,000,000 bytes');const text=await file.text();if(generation!==importGeneration)return;const obj=parseStrictJSON(text),next=obj.schema==='probeplan.session.v1'?validateSession(obj):createSession(compile(obj));await replace(next,t().loaded,generation);}catch(error){if(generation===importGeneration)showError(error);}
  });
  document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>download(button.dataset.export)));
  $('save').addEventListener('click',()=>{if(dirty||!acknowledged)return;try{localStorage.setItem(storageKey,toJSON(session));unsaved=false;$('restore').disabled=false;$('forget').disabled=false;notify(t().saved);}catch{notify(t().storageError,true);}});
  $('restore').addEventListener('click',async()=>{try{const saved=localStorage.getItem(storageKey);if(!saved)throw new Error('No saved session');const next=validateSession(parseStrictJSON(saved));if(await replace(next,t().restored))unsaved=false;}catch{notify(t().storageError,true);}});
  $('forget').addEventListener('click',async()=>{if(!await confirmAction('forget'))return;try{localStorage.removeItem(storageKey);$('restore').disabled=true;$('forget').disabled=true;notify(t().forgotten);}catch{notify(t().storageError,true);}});
}
window.addEventListener('beforeunload',event=>{if(unsaved){event.preventDefault();event.returnValue='';}});
render();if(savedExists())notify(t().savedAvailable);
