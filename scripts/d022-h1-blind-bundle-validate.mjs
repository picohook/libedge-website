#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
const [bundlePath,mapPath]=process.argv.slice(2);
if(!bundlePath||!mapPath) throw new Error("usage: node d022-h1-blind-bundle-validate.mjs <bundle.json> <map.jsonl>");
const raw=fs.readFileSync(bundlePath,"utf8"), b=JSON.parse(raw), map=fs.readFileSync(mapPath,"utf8").trim().split("\n").map(JSON.parse);
const errors=[], forbidden=["claim_id","scenario_id","stratum_id","author_intent","domain_id","partial_subtype","supported_features"];
if(b.bundle_version!=="D022-H1-B1"||b.holdout_version!=="D022-H1") errors.push("bundle_identity");
if(b.source_pool_sha256!=="8e191f4d728467a788a55f24725ada21e4a563323dd5f72252b78d93b0ab47cb") errors.push("source_pool_hash");
if(!Array.isArray(b.claims)||b.claims.length!==720) errors.push("count");
const serialized=JSON.stringify(b);
for(const k of forbidden) if(serialized.includes(`"${k}"`)) errors.push(`forbidden_key:${k}`);
for(let i=0;i<b.claims.length;i++){
 const x=b.claims[i], expected=`B${String(i+1).padStart(4,"0")}`;
 if(x.item_id!==expected) errors.push(`item_id:${i}`);
 if(JSON.stringify(Object.keys(x))!==JSON.stringify(["item_id","question","evidence_pack","claim_text"])) errors.push(`keys:${x.item_id}`);
 for(let j=0;j<x.evidence_pack.length;j++){
  const e=x.evidence_pack[j];
  if(e.evidence_id!==`E${String(j+1).padStart(2,"0")}`) errors.push(`evidence_id:${x.item_id}`);
  if(JSON.stringify(Object.keys(e))!==JSON.stringify(["evidence_id","text"])) errors.push(`evidence_keys:${x.item_id}`);
 }
}
if(map.length!==720||new Set(map.map(x=>x.item_id)).size!==720||new Set(map.map(x=>x.claim_id)).size!==720) errors.push("map_bijection");
for(let i=0;i<map.length;i++) if(map[i].item_id!==b.claims[i].item_id) errors.push(`map_order:${i}`);
const hash=crypto.createHash("sha256").update(raw,"utf8").digest("hex");
if(errors.length){console.error(JSON.stringify({valid:false,errors},null,2));process.exit(1);}
console.log(JSON.stringify({valid:true,count:720,bundle_sha256:hash,forbidden_metadata_keys_present:false,opaque_item_ids:true,local_evidence_ids:true,map_bijection:true}));
