#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
const [bundlePath,ratingPath,expectedRater]=process.argv.slice(2);
if(!bundlePath||!ratingPath||!["R1","R2"].includes(expectedRater)) throw new Error("usage: node d022-h1-rating-output-validate.mjs <bundle.json> <rating.json> <R1|R2>");
const bundleRaw=fs.readFileSync(bundlePath,"utf8"), out=JSON.parse(fs.readFileSync(ratingPath,"utf8"));
const bundle=JSON.parse(bundleRaw);\nconst hash=crypto.createHash("sha256").update(bundleRaw,"utf8").digest("hex");
const top=["holdout_version","bundle_sha256","rater_id","ratings","status"];
const ratingKeys=["claim_id","label"], labels=new Set(["SUPPORTED","PARTIALLY_SUPPORTED","UNSUPPORTED"]);
const errors=[];
if(JSON.stringify(Object.keys(out))!==JSON.stringify(top)) errors.push("top-level keys/order");
if(out.holdout_version!=="D022-H1") errors.push("holdout_version");
if(out.bundle_sha256!==hash) errors.push("bundle_sha256");
if(out.rater_id!==expectedRater) errors.push("rater_id");
if(out.status!=="FINAL / LOCKED") errors.push("status");
if(!Array.isArray(out.ratings)||out.ratings.length!==720) errors.push("ratings_count");
else {
 const ids=bundle.claims.map(x=>x.claim_id);
 const seen=new Set();
 for(let i=0;i<out.ratings.length;i++){
  const r=out.ratings[i];
  if(JSON.stringify(Object.keys(r))!==JSON.stringify(ratingKeys)) errors.push(`keys:${i}`);
  if(r.claim_id!==ids[i]) errors.push(`order_or_id:${i}`);
  if(seen.has(r.claim_id)) errors.push(`duplicate:${r.claim_id}`);
  seen.add(r.claim_id);
  if(!labels.has(r.label)) errors.push(`label:${r.claim_id}`);
 }
}
if(errors.length){console.error(JSON.stringify({valid:false,errors},null,2));process.exit(1);}
console.log(JSON.stringify({valid:true,rater_id:expectedRater,count:720,bundle_sha256:hash,status:out.status}));
