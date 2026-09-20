#!/usr/bin/env node
import assert from "node:assert/strict";
import { normalizeText,jaccard,failsThreshold,exactDuplicateCounts,pairwiseDiagnostics,domainGate } from "./d022-h1-validate.mjs";

let passed=0;
function test(name,fn){fn();passed++;console.log(`ok ${passed} - ${name}`);}

test("changed numbers alone do not evade detection",()=>{
  const a="The sample measured 41 units after 100 hours under protocol alpha.";
  const b="The sample measured 56 units after 900 hours under protocol alpha.";
  assert.equal(normalizeText(a),normalizeText(b));
  assert.equal(jaccard(a,b),1);
});

test("J = 0.70 fails exactly",()=>{ assert.equal(failsThreshold(0.70),true); });

test("J < 0.70 passes lexical threshold",()=>{ assert.equal(failsThreshold(0.699999),false); });

test("exact duplicate claim/evidence/comparison text fails duplicate gate",()=>{
  const base={question:"Q unique",evidence_pack:[{evidence_id:"S001:e01",text:"Evidence duplicate text here."}],claim_text:"Claim duplicate text here."};
  const a={...base,claim_id:"A"}, b={...base,claim_id:"B",evidence_pack:[{evidence_id:"S002:e01",text:"Evidence duplicate text here."}]};
  const d=exactDuplicateCounts([a,b]);
  assert.ok(d.claim_text>0 && d.evidence_text>0 && d.comparison_text>0);
});

test("same-scenario pairs are excluded from pairwise threshold",()=>{
  const a={scenario_id:"S001",claim_id:"A",stratum_id:"U1_NEAR_MISS",question:"same wording one",evidence_pack:[{text:"same evidence wording repeated"}],claim_text:"same claim wording repeated"};
  const b={scenario_id:"S001",claim_id:"B",stratum_id:"U1_NEAR_MISS",question:"same wording one",evidence_pack:[{text:"same evidence wording repeated"}],claim_text:"same claim wording repeated"};
  const d=pairwiseDiagnostics([a,b]);
  assert.equal(d.U1_NEAR_MISS.pair_count,0);
  assert.equal(d.U1_NEAR_MISS.ge_0_70,0);
});

test("domain caps and minimums fail when violated",()=>{
  const meta=[];
  for(let i=1;i<=120;i++) meta.push({scenario_id:`S${String(i).padStart(3,"0")}`,domain_id:"D01_MATERIALS_ENERGY"});
  assert.equal(domainGate(meta).pass,false);
});

console.log(`1..${passed}`);
