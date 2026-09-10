# P0.5 Hybrid Semantic Retrieval — Fresh Holdout

Status: `ACTIVE`
Qualifier: `HOLDOUT FROZEN — RETRIEVAL NOT YET EXECUTED`
Frozen: `2026-09-10`
Parent protocol: `docs/experiments/p05-hybrid-semantic.md`

## Construction integrity

This holdout was constructed only after the parent preregistration was FROZEN. No L/S/H retrieval result was inspected while constructing, tagging, balancing, auditing, or freezing these intents.

Exactly 40 previously unseen intents are included: 10 Materials/Energy, 10 Biomedical, 10 Social Science, and 10 Humanities.

Frozen slice counts after the pre-retrieval arithmetic audit:
- Conjunctive-intent (`C`): 17
- Lexical-ambiguity (`A`): 15
- Technical/jargon (`T`): 16

Slice tags may overlap. Untagged intents are valid straightforward/broad-conceptual cases and remain part of the gate.

From this freeze onward, no intent, wording, domain, or slice tag may be replaced/edited because of retrieval or relevance results. Exclusion is only by the parent protocol's frozen mechanical-validity rule.

## Frozen 40-query holdout

| ID | Domain | Intent | Frozen slices |
| --- | --- | --- | --- |
| ME01 | Materials/Energy | sodium-ion battery hard carbon low-temperature performance | C,T |
| ME02 | Materials/Energy | perovskite solar cell lead leakage encapsulation | C,T |
| ME03 | Materials/Energy | direct air capture sorbent humidity stability | C,T |
| ME04 | Materials/Energy | offshore wind turbine blade recycling | — |
| ME05 | Materials/Energy | solid-state battery interface pressure | A,T |
| ME06 | Materials/Energy | industrial heat electrification cement manufacturing | C |
| ME07 | Materials/Energy | redox flow battery membrane crossover | A,T |
| ME08 | Materials/Energy | thermal energy storage phase change materials buildings | A |
| ME09 | Materials/Energy | green ammonia maritime fuel lifecycle emissions | C |
| ME10 | Materials/Energy | critical minerals supply risk energy transition | A |
| BM01 | Biomedical | CAR-T cell exhaustion solid tumors | C,T |
| BM02 | Biomedical | GLP-1 receptor agonists cardiovascular outcomes obesity without diabetes | C,T |
| BM03 | Biomedical | liquid biopsy minimal residual disease colorectal cancer | C,T |
| BM04 | Biomedical | microbiome antibiotic resistance hospital patients | — |
| BM05 | Biomedical | organoid drug screening pancreatic cancer | — |
| BM06 | Biomedical | long COVID exercise intolerance mitochondrial dysfunction | C,T |
| BM07 | Biomedical | digital pathology domain shift external validation | A,T |
| BM08 | Biomedical | maternal vaccination infant respiratory syncytial virus protection | C |
| BM09 | Biomedical | senolytic therapy age-related frailty | A,T |
| BM10 | Biomedical | sleep regularity adolescent mental health | A |
| SS01 | Social Science | algorithmic management worker autonomy platform economy | C,A |
| SS02 | Social Science | congestion pricing public transit equity | C,A |
| SS03 | Social Science | generative AI university assessment academic integrity | — |
| SS04 | Social Science | childcare affordability maternal labor force participation | C |
| SS05 | Social Science | climate migration urban housing markets | — |
| SS06 | Social Science | police body cameras citizen trust | A |
| SS07 | Social Science | remote work promotion gender inequality | — |
| SS08 | Social Science | universal basic income entrepreneurship | — |
| SS09 | Social Science | misinformation correction political polarization | — |
| SS10 | Social Science | school smartphone bans student wellbeing | A |
| HU01 | Humanities | colonial archives indigenous knowledge repatriation | C,A |
| HU02 | Humanities | machine translation literary style preservation | C,A |
| HU03 | Humanities | medieval manuscript marginalia reader practices | T |
| HU04 | Humanities | digital reconstruction archaeological heritage destruction | — |
| HU05 | Humanities | oral history intergenerational trauma memory | — |
| HU06 | Humanities | museum restitution provenance research colonial collections | C,T |
| HU07 | Humanities | Ottoman print culture censorship nineteenth century | C,T |
| HU08 | Humanities | environmental humanities extractive landscapes literature | T |
| HU09 | Humanities | historical GIS urban segregation | A,T |
| HU10 | Humanities | public monuments contested memory | A |

## Frozen tag audit

### Conjunctive-intent — 17
ME01, ME02, ME03, ME06, ME09, BM01, BM02, BM03, BM06, BM08, SS01, SS02, SS04, HU01, HU02, HU06, HU07.

### Lexical-ambiguity — 15
ME05, ME07, ME08, ME10, BM07, BM09, BM10, SS01, SS02, SS06, SS10, HU01, HU02, HU09, HU10.

### Technical/jargon — 16
ME01, ME02, ME03, ME05, ME07, BM01, BM02, BM03, BM06, BM07, BM09, HU03, HU06, HU07, HU08, HU09.

All three required slice minima are exceeded before retrieval begins.

## Next permitted operation

Execute L and S retrieval exactly once per frozen intent under the parent protocol. H must be computed only from the already retrieved L/S pools. Passive charged-cost/credit telemetry is active for this batch. No holdout wording/tag changes are permitted after retrieval begins.

Last updated: 2026-09-10
