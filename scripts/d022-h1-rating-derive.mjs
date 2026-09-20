#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";

const [r1RawPath,r2RawPath,idMapPath,poolPath,outDir] = process.argv.slice(2);
if (![r1RawPath,r2RawPath,idMapPath,poolPath,outDir].every(Boolean)) {
  console.error("usage: node d022-h1-rating-derive.mjs <r1-raw> <r2-raw> <id-map> <pool-jsonl> <out-dir>");
  process.exit(2);
}
const sha256=b=>crypto.createHash("sha256").update(b).digest("hex");
const extract=raw=>{
  const a=raw.indexOf("{"), z=raw.lastIndexOf("}");
  if(a<0||z<a) throw new Error("no JSON object found");
  return JSON.parse(raw.slice(a,z+1));
};
const raw1=fs.readFileSync(r1RawPath,"utf8"), raw2=fs.readFileSync(r2RawPath,"utf8");
const r1=extract(raw1), r2=extract(raw2);
for (const [name,r] of [["R1",r1],["R2",r2]]) {
  if(r.rater_id!==name||r.status!=="FINAL / LOCKED"||r.ratings.length!==720) throw new Error(name+" locked payload invalid");
  const ids=r.ratings.map(x=>x.item_id);
  if(new Set(ids).size!==720) throw new Error(name+" duplicate IDs");
  for(let i=0;i<720;i++) if(ids[i]!=="B"+String(i+1).padStart(4,"0")) throw new Error(name+" order mismatch at "+i);
}
const idmap=fs.readFileSync(idMapPath,"utf8").trim().split("\n").map(JSON.parse);
const pool=fs.readFileSync(poolPath,"utf8").trim().split("\n").map(JSON.parse);
const strata=new Map(pool.map(x=>[x.claim_id,x.stratum_id]));
const rows=[]; const counts={PRIMARY_SUPPORTED:0,PRIMARY_UNSUPPORTED:0,CHALLENGE_DISAGREEMENT:0}; const by_stratum={};
let agreement=0;
for(let i=0;i<720;i++){
 const a=r1.ratings[i],b=r2.ratings[i],m=idmap[i];
 if(a.item_id!==b.item_id||a.item_id!==m.item_id) throw new Error("mapping mismatch "+i);
 if(a.label===b.label) agreement++;
 const st=strata.get(m.claim_id); if(!st) throw new Error("missing stratum "+m.claim_id);
 const cc=a.label==="SUPPORTED"&&b.label==="SUPPORTED"?"PRIMARY_SUPPORTED":a.label==="UNSUPPORTED"&&b.label==="UNSUPPORTED"?"PRIMARY_UNSUPPORTED":"CHALLENGE_DISAGREEMENT";
 counts[cc]++; by_stratum[st]??={PRIMARY_SUPPORTED:0,PRIMARY_UNSUPPORTED:0,CHALLENGE_DISAGREEMENT:0}; by_stratum[st][cc]++;
 rows.push(JSON.stringify({item_id:a.item_id,claim_id:m.claim_id,stratum_id:st,r1_label:a.label,r2_label:b.label,consensus_class:cc}));
}
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(outDir+"/d022-h1-r1-locked.normalized.json",JSON.stringify(r1)+"\n");
fs.writeFileSync(outDir+"/d022-h1-r2-locked.extracted.json",JSON.stringify(r2)+"\n");
fs.writeFileSync(outDir+"/d022-h1-r1-r2-consensus.jsonl",rows.join("\n")+"\n");
console.log(JSON.stringify({raw_sha256:{R1:sha256(Buffer.from(raw1)),R2:sha256(Buffer.from(raw2))},agreement,counts,by_stratum},null,2));
