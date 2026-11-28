'use strict';
const SOURCE='https://raw.githubusercontent.com/kcwiki/kancolle-data/master/api/api_start2.json';
function assert(ok,msg){if(!ok)throw new Error(msg)}
const int=(x,min=0)=>Number.isInteger(x)&&x>=min;
const unique=(arr,label)=>assert(new Set(arr).size===arr.length,label+' duplicate IDs');
// Terminal strongly connected components include all reversible conversion forms.
function remodelStages(player,upgrades){
 const ids=new Set(player.map(x=>x.api_id));
 const edges=new Map([...ids].map(id=>[id,new Set()]));
 const incoming=new Map([...ids].map(id=>[id,new Set()]));
 function link(from,to){
  assert(ids.has(from)&&ids.has(to),'invalid remodel edge: '+from+' -> '+to);
  if(from===to)return;
  edges.get(from).add(to);incoming.get(to).add(from);
 }
 for(const ship of player){
  assert(ship.api_aftershipid!==undefined&&ship.api_aftershipid!==null&&String(ship.api_aftershipid).trim()!=='','missing remodel target: '+ship.api_id);
  const target=Number(ship.api_aftershipid);
  assert(int(target),'invalid remodel target: '+ship.api_id);
  if(target)link(ship.api_id,target);
 }
 for(const u of upgrades){
  assert(int(u.api_current_ship_id)&&int(u.api_id,1),'invalid ship upgrade record');
  if(u.api_current_ship_id&&ids.has(u.api_current_ship_id))link(u.api_current_ship_id,u.api_id);
 }
 function reachable(id){
  const seen=new Set([id]),queue=[id];
  for(let i=0;i<queue.length;i++)for(const to of edges.get(queue[i]))if(!seen.has(to)){seen.add(to);queue.push(to);}
  return seen;
 }
 const stages=new Map(),reach=new Map([...ids].map(id=>[id,reachable(id)]));
 for(const id of ids){
  if(!incoming.get(id).size&&!edges.get(id).size){stages.set(id,'standalone');continue;}
  const terminal=[...reach.get(id)].every(to=>reach.get(to).has(id));
  stages.set(id,terminal?'final':!incoming.get(id).size?'base':'middle');
 }
 return stages;
}
function extract(raw,sha){
 assert(/^[a-f0-9]{40}$/.test(sha),'invalid source blob SHA');
 const a=raw.api_data||raw;
 for(const k of ['api_mst_ship','api_mst_stype','api_mst_slotitem','api_mst_mission','api_mst_shipupgrade'])assert(Array.isArray(a[k])&&a[k].length>0,'missing '+k);
 const types=Object.fromEntries(a.api_mst_stype.map(x=>[x.api_id,x.api_name]));
 unique(a.api_mst_stype.map(x=>x.api_id),'ship type');
 assert(a.api_mst_stype.every(x=>int(x.api_id,1)&&typeof x.api_name==='string'&&x.api_name.trim()),'invalid ship type');
 const player=a.api_mst_ship.filter(x=>x.api_id<1500&&x.api_sortno>0);
 const stages=remodelStages(player,a.api_mst_shipupgrade);
 const ships=player.map(x=>[x.api_id,x.api_name,x.api_stype,x.api_fuel_max,x.api_bull_max,stages.get(x.api_id),x.api_slot_num]).sort((a,b)=>a[0]-b[0]);
 assert(ships.length>=800&&ships.every(([id,name,type,fuel,ammo,stage,slots])=>int(id,1)&&typeof name==='string'&&name.trim()&&types[type]&&int(fuel)&&int(ammo)&&int(slots)),'invalid player ship data');
 unique(ships.map(x=>x[0]),'ship');
 assert(ships.some(x=>x[0]===487),'Kinu Kai Ni missing');
 const equipment=a.api_mst_slotitem.map(x=>[x.api_id,x.api_name,x.api_type]).sort((a,b)=>a[0]-b[0]);
 assert(equipment.length>=600&&equipment.every(([id,name,type])=>int(id,1)&&typeof name==='string'&&name.trim()&&Array.isArray(type)&&type.length>=3&&type.every(t=>int(t))),'invalid equipment data');
 unique(equipment.map(x=>x[0]),'equipment');
 assert(a.api_mst_mission.every(x=>typeof x.api_use_fuel==='number'&&Number.isFinite(x.api_use_fuel)&&x.api_use_fuel>=0&&x.api_use_fuel<=1&&typeof x.api_use_bull==='number'&&Number.isFinite(x.api_use_bull)&&x.api_use_bull>=0&&x.api_use_bull<=1),'missing or invalid consumption ratio');
 const expeditions=a.api_mst_mission.map(x=>({id:x.api_disp_no,apiId:x.api_id,name:x.api_name,minutes:x.api_time,fuelPct:Math.round(x.api_use_fuel*100),ammoPct:Math.round(x.api_use_bull*100),deckNum:x.api_deck_num,sampleFleet:x.api_sample_fleet,resetType:x.api_reset_type,damageType:x.api_damage_type})).sort((a,b)=>a.apiId-b.apiId);
 assert(expeditions.length>=61&&expeditions.every(x=>typeof x.id==='string'&&x.id.length&&int(x.apiId,1)&&typeof x.name==='string'&&x.name.trim()&&int(x.minutes,1)&&int(x.fuelPct)&&x.fuelPct<=100&&int(x.ammoPct)&&x.ammoPct<=100&&int(x.deckNum)&&Array.isArray(x.sampleFleet)&&int(x.resetType)&&int(x.damageType)),'invalid expedition data');
 unique(expeditions.map(x=>x.id),'expedition display');unique(expeditions.map(x=>x.apiId),'expedition API');
 return {schema:3,source:SOURCE,sourceSha:sha,types,ships,equipment,expeditions};
}
function changes(old,next){
 const out={};
 for(const [key,id] of [['ships',x=>x[0]],['equipment',x=>x[0]],['expeditions',x=>x.id],['types',x=>x[0]]]){
 const entries=m=>key==='types'?Object.entries(m.types):m[key];
 const a=new Map(entries(old).map(x=>[id(x),x])),b=new Map(entries(next).map(x=>[id(x),x]));
 out[key]={added:[...b.keys()].filter(k=>!a.has(k)),removed:[...a.keys()].filter(k=>!b.has(k)),changed:[...b.keys()].filter(k=>a.has(k)&&JSON.stringify(a.get(k))!==JSON.stringify(b.get(k)))};
 }
 return out;
}
function guard(old,next,rules){
 const diff=changes(old,next);
 for(const [key,d] of Object.entries(diff))assert(!d.removed.length,key+' IDs removed; manual review required: '+d.removed.join(', '));
 const ids=new Set(next.expeditions.map(x=>x.id));
 for(const rule of rules)assert(ids.has(rule.id),'manual expedition missing upstream: '+rule.id);
 return diff;
}
function files(master){
 const json=JSON.stringify(master,null,2)+'\n';
 const bundle='// Generated by scripts/update-master.cjs; do not edit.\nwindow.KC_MASTER='+JSON.stringify(master).replace(/</g,'\\u003c')+';\n';
 const manifest=JSON.stringify({schema:master.schema,source:master.source,sourceSha:master.sourceSha,counts:{ships:master.ships.length,types:Object.keys(master.types).length,equipment:master.equipment.length,expeditions:master.expeditions.length}},null,2)+'\n';
 return {'data/game-master.json':json,'data/game-master.js':bundle,'data/manifest.json':manifest};
}
module.exports={extract,changes,guard,files,SOURCE,remodelStages};

if(require.main===module){
 const fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
 const old=JSON.parse(fs.readFileSync('data/game-master.json','utf8'));
 const readRules=()=>{const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('data/expedition-rules.js','utf8'),sandbox);return sandbox.window.KC_EXPEDITION_RULES};
 const check=()=>{for(const [path,content] of Object.entries(files(old)))assert(fs.readFileSync(path,'utf8')===content,'generated file mismatch: '+path);guard(old,old,readRules());console.log('Master bundle consistency OK')};
 (async()=>{
 if(process.argv.includes('--check')){check();return;}
 check();
 const inputIndex=process.argv.indexOf('--input');
 let bytes;
 if(inputIndex>=0){assert(process.argv[inputIndex+1],'--input requires path');bytes=fs.readFileSync(process.argv[inputIndex+1])}
 else{const response=await fetch(SOURCE,{signal:AbortSignal.timeout(30000)});assert(response.ok,'HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer())}
 const sha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const next=extract(JSON.parse(bytes.toString('utf8')),sha);
 const diff=guard(old,next,readRules());
 const changed=old.schema!==next.schema||Object.values(diff).some(d=>d.added.length||d.changed.length||d.removed.length);
 console.log(JSON.stringify(diff,null,2));
 if(!changed){console.log('No relevant master changes');return;}
 for(const [path,content] of Object.entries(files(next)))fs.writeFileSync(path,content);
 fs.writeFileSync('master-diff.json',JSON.stringify(diff,null,2)+'\n');
 console.log('Updated master: '+sha);
 })().catch(err=>{console.error(err);process.exitCode=1});
}
