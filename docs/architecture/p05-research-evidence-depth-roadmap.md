# Research Evidence-Depth Roadmap

Status: `ROADMAP`  
Related: #441, #446, #471, #495  
Production authorization remains governed separately by #399.

## Why this exists

LibEdge Research already has a strong trust-oriented chain:

`retrieval → evidence depth → atomic claims → Fresh-Checker → verified synthesis → traceable evidence`

The current ceiling is no longer just retrieval ranking. The Research evidence model supports `FULL_TEXT | ABSTRACT | METADATA_ONLY`, but the current provider path is primarily metadata/abstract based. OpenAlex and Crossref supply scholarly discovery/metadata; the optional Unpaywall path enriches access metadata but is not a full-text passage acquisition pipeline.

The #471 benchmark work therefore measures evidence depth explicitly rather than treating retrieved-result count as evidence quality.

## Product thesis

Do not position LibEdge as a smaller copy of general academic search products.

The differentiated direction is an **access-aware, verified academic research workspace**:

> Find research the institution can actually access, verify what the evidence supports, and make the support traceable.

That direction builds on existing LibEdge concepts such as authorized evidence, institutional subscriptions, fail-closed grounding, verified atomic claims, supporting-source breadth, and content-free operational telemetry.

## Recommended sequence

### 1. Finish the reliable core

Complete the controlled rich/sparse benchmark line (#441/#446/#471), diagnose grounding/checker latency without weakening verification, and keep the modern Research Admin as the content-free operational surface.

Do not increase candidate depth or weaken grounding merely to improve acceptance rates. Retrieval breadth, evidence depth, grounding success, latency, and cost remain separate signals.

### 2. Pilot full-text evidence acquisition narrowly

Before generalizing institutional full-text access, prove one end-to-end path with:

- one real institution;
- one or two publishers or access routes the institution is already entitled to use;
- authorized access resolution;
- full-text acquisition under the applicable access terms;
- passage extraction;
- claim-to-passage grounding;
- traceable evidence in the Research workspace.

This is both an engineering and an authorization/licensing problem. A narrow real pilot should precede broad product claims or a generalized publisher integration layer.

### 3. Turn golden questions into a versioned benchmark

Scale the current small golden-question set deliberately toward a larger benchmark only after defining a stable method.

The benchmark should have:

- versioned questions and expected evidence conditions;
- a fixed scoring rubric;
- rich and genuinely measured evidence-sparse cases;
- regression-comparable retrieval, evidence-depth, grounding, latency, and cost metrics;
- no benchmark-specific routing or special casing.

More questions without a stable rubric would increase anecdotal coverage, not measurement quality.

### 4. Grow into a research workspace

Once evidence acquisition and grounding are reliable, evolve the interaction from a single answer toward:

`research question → verified synthesis → evidence state/map → papers → passages → follow-up investigation`

Possible later workspace capabilities include saved projects/collections, paper comparison, evidence tables, citation-graph exploration, and follow-up research. These are downstream of the evidence engine rather than substitutes for it.

### 5. Build the institutional advantage

Longer term, combine authorized institutional subscriptions with open-access sources and user-authorized documents/collections so Research can reason over evidence the user can legitimately reach.

The defensible product boundary is not corpus size alone. It is the combination of:

- access awareness;
- evidence depth;
- verified claims;
- traceability;
- operational cost/privacy discipline.

## Cost and authorization gate

Every new evidence-acquisition integration introduces external dependency, privacy, authorization, and potentially recurring cost.

Treat each provider/integration as a governed capability, not merely a feature:

1. define the exact data/access boundary;
2. define the runtime and cost model;
3. validate privacy and content handling;
4. test in staging;
5. record rollback/fail-closed behavior;
6. require explicit production authorization where infrastructure, secrets, paid services, or production routing change.

Historical staging or capacity evidence does not authorize new production infrastructure. #399 remains the production authorization boundary for the current R2 path.

## Non-goals

This roadmap does **not** authorize:

- production infrastructure or IAM changes;
- publisher scraping or bypassing access controls;
- weakening Fresh-Checker, grounding thresholds, model pins, D-023, or fail-closed behavior;
- presenting metadata-only records as full-text evidence;
- claiming comprehensive institutional full-text coverage before a real end-to-end pilot proves it;
- benchmark-specific code paths.

## Near-term decision gates

- **#446:** freeze a sparse golden question only from measured bounded final evidence depth; if candidates are not metadata-heavy, reject them and iterate.
- **#471:** use controlled staging comparisons to determine retrieval/evidence behavior and isolate downstream checker/grounding latency. Candidate depth is not assumed to be the answer.
- **Full-text pilot:** begin only with a concrete institution/access route and an explicit authorization model.
- **Production:** remains separately gated by #399 and explicit maintainer authorization.
