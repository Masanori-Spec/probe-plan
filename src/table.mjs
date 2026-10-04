import {normalizeMap} from './core.mjs';
export function mapToRows(input) {
  const map=normalizeMap(input),assignments=new Map(map.nets.flatMap(n=>n.pins.map(p=>[JSON.stringify([p.connector,p.pin]),n.id])));
  return map.connectors.flatMap(c=>c.pins.map(pin=>({connector:c.id,label:c.label,pin,net:assignments.get(JSON.stringify([c.id,pin]))??'-'})));
}
export function rowsToMap(title,rows) {
  if(!Array.isArray(rows)||rows.length>32) throw new Error('Table: at most 32 rows');
  const connectors=new Map(),nets=new Map(),unused=[];
  for(const row of rows) {
    const c=connectors.get(row.connector);
    if(c && c.label!==row.label) throw new Error(`Connector ${row.connector}: every row must use the same label`);
    if(!c) connectors.set(row.connector,{id:row.connector,label:row.label,pins:[]});
    connectors.get(row.connector).pins.push(row.pin);
    const ref={connector:row.connector,pin:row.pin};
    if(row.net==='-') unused.push(ref);
    else { if(!nets.has(row.net)) nets.set(row.net,{id:row.net,pins:[]}); nets.get(row.net).pins.push(ref); }
  }
  return normalizeMap({schema:'probeplan.pinmap.v1',title,connectors:[...connectors.values()],nets:[...nets.values()],unused});
}
