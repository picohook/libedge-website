#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export const STRATA = [
  "U1_NEAR_MISS","U2_SCOPE_SHIFT","U3_CAUSAL_MECHANISTIC",
  "U4_TEMPORAL_GENERALIZATION","U5_CONFLICT_SIDE","U6_CITATION_SEMANTIC_MISMATCH",
  "S_SUPPORTED","P_PARTIAL_EXTENSION"
];
export const DOMAINS = [
  "D01_MATERIALS_ENERGY","D02_BIOMEDICAL_CLINICAL","D03_EDUCATION_SURVEY","D04_SOFTWARE_SYSTEMS",
  "D05_BUSINESS_OPERATIONS","D06_ENVIRONMENT_AGRICULTURE","D07_ENGINEERING_MANUFACTURING",
  "D08_PUBLIC_SERVICES_TRANSPORT","D09_LIBRARY_RESEARCH_METADATA","D10_CONSUMER_PRODUCT_TESTING",
  "D11_SOCIAL_BEHAVIORAL_STUDIES","D12_HISTORICAL_ARCHIVAL_RECORDS"
];
const KEYS=["holdout_version","scenario_id","claim_id","stratum_id","question","evidence_pack","claim_text","author_intent"];

export function normalizeText(s) {
  return s.normalize("NFC").toLowerCase().replace(/\s+/gu," ").trim().replace(/\p{Nd}+/gu,"<num>");
}
export function tokens(s) {
  return normalizeText(s).match(/<num>|\p{L}+/gu) ?? [];
}
export function trigramSet(s) {
  const t=tokens(s), out=new Set();
  for(let i=0;i+2<t.length;i++) out.add(JSON.stringify([t[i],t[i+1],t[i+2]]));
  return out;
}
export function jaccard(a,b) {
  const A=trigramSet(a), B=trigramSet(b);
  const union=new Set([...A,...B]);
  if(!union.size) return 1;
  let inter=0; for(const x of A) if(B.has(x)) inter++;
  return inter/union.size;
}
export const failsThreshold = j => j >= 0.70;
export function comparisonText(r) {
  return `${r.question} ${r.evidence_pack.map(e=>e.text).join(" ")} ${r.claim_text}`;
}
export function canonicalize(records) {
  const sorted=[...records].sort((a,b)=>a.claim_id.localeCompare(b.claim_id,"en"));
  return sorted.map(r=>{
    const o={}; for(const k of KEYS) o[k]=r[k];
    return JSON.stringify(o);
  }).join("\n")+"\n";
}
export function domainGate(meta) {
  const neg=meta.filter(x=>Number(x.scenario_id.slice(1))<=80);
  const count=x=>Object.fromEntries(DOMAINS.map(d=>[d,x.filter(v=>v.domain_id===d).length]));
  const n=count(neg), all=count(meta);
  const negRepresented=Object.values(n).filter(v=>v>0).length;
  const negAtLeast6=Object.values(n).filter(v=>v>=6).length;
  const pass=negRepresented>=10 && Math.max(...Object.values(n))<=10 && negAtLeast6>=6 &&
    Object.values(all).every(v=>v>0) && Math.max(...Object.values(all))<=15;
  return {pass,negative_counts:n,all_counts:all,negative_domains_represented:negRepresented,negative_domains_at_least_6:negAtLeast6};
}
export function pairwiseDiagnostics(records) {
  const out={};
  for(const stratum of STRATA) {
    const rr=records.filter(r=>r.stratum_id===stratum);
    let pairs=0,max=-1,maxPair=null,ge50=0,ge60=0,ge70=0;
    for(let i=0;i<rr.length;i++) for(let j=i+1;j<rr.length;j++) {
      if(rr[i].scenario_id===rr[j].scenario_id) continue;
      const v=jaccard(comparisonText(rr[i]),comparisonText(rr[j])); pairs++;
      if(v>max){max=v;maxPair=[rr[i].claim_id,rr[j].claim_id];}
      if(v>=.5)ge50++; if(v>=.6)ge60++; if(v>=.7)ge70++;
    }
    out[stratum]={pair_count:pairs,max_jaccard:max,max_pair:maxPair,ge_0_50:ge50,ge_0_60:ge60,ge_0_70:ge70,pass:ge70===0};
  }
  return out;
}
export function exactDuplicateCounts(records) {
  const fields={
    claim_text:r=>normalizeText(r.claim_text),
    evidence_text:r=>normalizeText(r.evidence_pack.map(e=>e.text).join(" ")),
    comparison_text:r=>normalizeText(comparisonText(r))
  };
  const out={};
  for(const [name,fn] of Object.entries(fields)){
    const seen=new Map(); let dup=0;
    for(const r of records){const x=fn(r); if(seen.has(x))dup++; else seen.set(x,r.claim_id);}
    out[name]=dup;
  }
  return out;
}
export function scenarioChecks(records) {
  let failures=0;
  for(let n=1;n<=120;n++){
    const sid=`S${String(n).padStart(3,"0")}`, rr=records.filter(r=>r.scenario_id===sid);
    if(rr.length!==6){failures++;continue;}
    if(new Set(rr.map(r=>normalizeText(r.claim_text))).size!==6) failures++;
    for(const r of rr) if(new Set(r.evidence_pack.map(e=>e.evidence_id)).size!==r.evidence_pack.length) failures++;
    if(n<=80){
      const us=rr.map(r=>r.stratum_id).sort();
      if(JSON.stringify(us)!==JSON.stringify(STRATA.slice(0,6).sort())) failures++;
    }
  }
  return {pass:failures===0,failures};
}
export function validate(records,meta) {
  const errors=[];
  if(records.length!==720) errors.push("record_count");
  if(new Set(records.map(r=>r.scenario_id)).size!==120) errors.push("scenario_count");
  const counts=Object.fromEntries(STRATA.map(s=>[s,records.filter(r=>r.stratum_id===s).length]));
  const expected={U1_NEAR_MISS:80,U2_SCOPE_SHIFT:80,U3_CAUSAL_MECHANISTIC:80,U4_TEMPORAL_GENERALIZATION:80,U5_CONFLICT_SIDE:80,U6_CITATION_SEMANTIC_MISMATCH:80,S_SUPPORTED:150,P_PARTIAL_EXTENSION:90};
  if(JSON.stringify(counts)!==JSON.stringify(expected)) errors.push("stratum_counts");
  const negativeEvidenceUse=new Map();
  for(const r of records){
    if(JSON.stringify(Object.keys(r))!==JSON.stringify(KEYS)) errors.push(`keys:${r.claim_id}`);
    if(r.holdout_version!=="D022-H1") errors.push(`version:${r.claim_id}`);
    if(!/^S\d{3}$/.test(r.scenario_id)) errors.push(`scenario_id:${r.claim_id}`);
    if(r.claim_id!==`D022-H1-${r.scenario_id}-C${r.claim_id.slice(-2)}` || !/^D022-H1-S\d{3}-C0[1-6]$/.test(r.claim_id)) errors.push(`claim_id:${r.claim_id}`);
    if(r.evidence_pack.length<1||r.evidence_pack.length>6) errors.push(`evidence_count:${r.claim_id}`);
    const ids=r.evidence_pack.map(e=>e.evidence_id);
    if(new Set(ids).size!==ids.length) errors.push(`duplicate_evidence_id:${r.claim_id}`);
    for(const id of ids){
      if(!id.startsWith(`${r.scenario_id}:e`)) errors.push(`evidence_scope:${r.claim_id}`);
      if(r.stratum_id.startsWith("U")) negativeEvidenceUse.set(id,(negativeEvidenceUse.get(id)||0)+1);
    }
    if(r.stratum_id.startsWith("U") && r.author_intent!=="UNSUPPORTED") errors.push(`intent:${r.claim_id}`);
    if(r.stratum_id==="S_SUPPORTED" && r.author_intent!=="SUPPORTED") errors.push(`intent:${r.claim_id}`);
    if(r.stratum_id==="P_PARTIAL_EXTENSION" && r.author_intent!=="PARTIALLY_SUPPORTED") errors.push(`intent:${r.claim_id}`);
    if(tokens(comparisonText(r)).length<3) errors.push(`too_short:${r.claim_id}`);
  }
  if([...negativeEvidenceUse.values()].some(v=>v>3)) errors.push("negative_evidence_contribution_limit");
  const dg=domainGate(meta); if(!dg.pass) errors.push("domain_gate");
  const pd=pairwiseDiagnostics(records); if(Object.values(pd).some(x=>!x.pass)) errors.push("lexical_gate");
  const dd=exactDuplicateCounts(records); if(Object.values(dd).some(x=>x!==0)) errors.push("exact_duplicate");
  const sc=scenarioChecks(records); if(!sc.pass) errors.push("scenario_checks");
  return {overall_pass:errors.length===0,errors,record_count:records.length,scenario_count:new Set(records.map(r=>r.scenario_id)).size,
    stratum_counts:counts,domain_gate:dg,pairwise:pd,exact_duplicates:dd,scenario_checks:sc};
}
export function sha256(s){return crypto.createHash("sha256").update(s,"utf8").digest("hex");}

function main(){
  const [sourcePath,canonicalPath,metaPath,qaPath,summaryPath]=process.argv.slice(2);
  if(!sourcePath||!canonicalPath||!metaPath||!qaPath||!summaryPath) throw new Error("usage: validator <source.json> <canonical.jsonl> <meta.jsonl> <construction-qa.jsonl> <summary.json>");
  const source=JSON.parse(fs.readFileSync(sourcePath,"utf8"));
  const canonical=canonicalize(source);
  const existing=fs.readFileSync(canonicalPath,"utf8");
  assert.equal(existing,canonical,"canonical JSONL differs from deterministic serialization");
  assert.equal(canonicalize(JSON.parse(`[${canonical.trim().split("\n").join(",")}]`)),canonical,"canonicalization is not idempotent");
  const meta=fs.readFileSync(metaPath,"utf8").trim().split("\n").map(JSON.parse);
  const summary=validate(source,meta);
  const qa=fs.readFileSync(qaPath,"utf8").trim().split("\n").map(JSON.parse);
  if(qa.length!==720) { summary.overall_pass=false; summary.errors.push("construction_qa_count"); }
  const qaById=new Map(qa.map(x=>[x.claim_id,x]));
  for(const r of source){
    const q=qaById.get(r.claim_id);
    if(!q || !q.self_contained || !q.intended_stratum_rule_satisfied || !q.not_trivial_or_unrelated ||
       q.outside_knowledge_required || q.paraphrase_clone || !q.evidence_id_integrity || !q.evidence_contribution_limit_pass){
      summary.overall_pass=false; summary.errors.push(`construction_qa:${r.claim_id}`);
    }
  }
  const featureCounts={}, partialSubtypeCounts={};
  for(const q of qa){
    for(const f of q.supported_features||[]) featureCounts[f]=(featureCounts[f]||0)+1;
    if(q.partial_subtype) partialSubtypeCounts[q.partial_subtype]=(partialSubtypeCounts[q.partial_subtype]||0)+1;
  }
  summary.construction_qa={record_count:qa.length,all_record_checks_pass:!summary.errors.some(e=>e.startsWith("construction_qa")),
    supported_feature_counts:featureCounts,partial_subtype_counts:partialSubtypeCounts};
  summary.pool_sha256=sha256(canonical);
  fs.writeFileSync(summaryPath,JSON.stringify(summary,null,2)+"\n");
  if(!summary.overall_pass){console.error(JSON.stringify(summary,null,2));process.exit(1);}
  console.log(JSON.stringify({overall_pass:true,pool_sha256:summary.pool_sha256,record_count:summary.record_count,scenario_count:summary.scenario_count}));
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) main();
