# LibEdge Research Golden Set v1 — Preregistration

Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED BEFORE QUESTION AUTHORING OR EXECUTION`

Prepared: 2026-10-06

Related: #536, #399, #495, #579. This protocol borrows the repository's D-022 discipline: freeze the evaluation contract before measured results, isolate development material from a fresh holdout, preserve blind judgments, and close/re-version rather than tune a failed frozen round in place.

## Decision owner and purpose

The acceptance target is a product decision owned by the LibEdge maintainer/product owner, not by the implementer. The implementer may build the harness and execute the frozen protocol but may not select, relax, reinterpret, or post-hoc tune the acceptance threshold.

Golden Set v1 answers a bounded question: **for each declared pilot domain, does the exact Research candidate produce a verified, fail-closed answer often enough to include that domain in the pilot, and are checker rejections consistent with blind human judgments?**

It is not a claim that all of social science, humanities, or biomedicine “works.”

## Frozen populations

### Development/tuning set — 15 questions

Exactly 15 questions:
- 5 humanities: 3 English + 2 Turkish;
- 5 biomedical: 3 English + 2 Turkish;
- 5 social-science: 3 English + 2 Turkish.

This set may be used for diagnosis and targeted engineering. Its results are never included in acceptance denominators.

### Fresh held-out acceptance set — 90 questions

Exactly 90 previously unused questions:
- 30 humanities;
- 30 biomedical;
- 30 social-science.

### Frozen language strata

Because the intended pilot is a Turkish university-library setting, language behavior is part of acceptance evidence rather than a later UI-only concern.

Within **each 30-question domain block** freeze:
- **20 English queries**;
- **10 Turkish queries**.

Thus the 90-question held-out contains exactly **60 English + 30 Turkish queries**, with Turkish represented equally across humanities, biomedical and social science. Questions must be authored naturally in the target language; the Turkish stratum must not be produced by mechanically translating an already-executed English question.

The existing 30-question domain gate remains primary and unchanged. In addition, report verified-answer numerator/denominator separately for English and Turkish within every domain, plus language-policy rejection counts. **No language stratum may be hidden by an aggregate domain result.**

Because the intended pilot UI is Turkish, a domain may be declared **Turkish-supported** only if its frozen Turkish stratum independently reaches **>=70% (at least 7/10)**. This language gate is frozen before results and uses the same outward `ok: true, code: OK` numerator contract. A domain can therefore pass the 21/30 domain gate yet still be excluded from Turkish-supported pilot scope if it fails 7/10 Turkish. Report a two-sided 95% Wilson interval for the small 10-query language stratum as uncertainty context; do not present 7/10 as a precise estimate of language-wide reliability.

The held-out questions MUST NOT be exposed to retrieval/generation/checker tuning before candidate freeze. They must not reuse the three diagnostic queries from #536 or questions used in earlier retrieval experiments.

### Held-out authorship and representativeness

The 90 held-out questions MUST be authored/curated by people who did **not** implement or tune Research retrieval, generation, grounding, checker behavior, thresholds, or the #536 diagnostic cases. The implementer may provide the frozen schema/template but may not select, rewrite, substitute, or remove held-out questions after seeing system behavior.

Before held-out authoring starts, the product owner/reviewer freezes a **provenance plan** stating which questions, if any, come from authentic intended-pilot library/user information needs collected without running them through Research, and which quota cells require independent subject-informed authoring. Once frozen, the implementer may not change those provenance allocations.

Use authentic pilot-user needs wherever they are actually available; do not fabricate or relabel synthetic questions as user-sourced. Any remaining domain/language quota is filled by an independent subject-informed author who has not participated in system tuning. The final report gives provenance-class counts by domain/language and explicitly states the representativeness limitation if no or few authentic pilot-user questions were available. Record provenance class and author role in the sealed manifest without exposing answer-bearing expectations.

Turkish held-out questions must be authored naturally by a Turkish-competent author; they must not be machine translations or translations of previously executed English questions.

Within each domain, question construction must deliberately vary topic, wording, answer shape, specificity, and expected evidence availability. The construction manifest must record only non-answer-bearing strata needed to prove diversity. No question may be selected because its result is already known.

Question bundle, IDs, provenance class, author-role independence attestation, domain/language allocation, rubric, exact candidate/config fingerprint, and this acceptance contract are frozen and independently reviewed before the first held-out execution.

## Pre-freeze development latency calibration

Before the exact candidate fingerprint is frozen, run the bounded #579 latency sample on the **15-question development/tuning set only**, with the reviewed **2 x ml.m5.large** staging checker shape and cache OFF. Use its individual-call and application queue-wait diagnostics to decide whether the intended timeout/concurrency values are viable. Any pre-freeze adjustment must stay within reviewed implementation bounds and be reconciled with #399's capacity/cost boundary. Held-out questions remain sealed.

After that diagnostic decision, freeze the exact candidate. Held-out results may not be used to tune timeout or concurrency.

## Exact candidate freeze

Before execution record:
- application commit SHA;
- retrieval mode/candidate-depth configuration;
- answer-provider route/model;
- Fresh-Checker model/revision/manifest/pin;
- checker threshold and decision contract;
- support-check concurrency and timeout;
- evidence/language/depth policy versions;
- cache state;
- staging endpoint instance type/count.

Any material change after held-out execution begins closes v1. A changed candidate requires a separately preregistered successor version; do not repair v1 in place.

## Primary product metric — query-level verified-answer rate

For each domain independently:

`verified_answer_rate = held-out queries whose frozen Research response contract ends with \`ok: true, code: OK\` / 30 held-out queries`

Only the existing outward success contract (`ok: true`, `code: OK`) enters the numerator. No reviewer judgment, partial answer, cached result, or diagnostic interpretation may promote another outcome into the numerator.

### Usefulness floor for an OK answer

A technically verified but trivial answer must not satisfy the pilot gate. For v1, an `OK` row counts toward the 21/30 (and 7/10 Turkish) numerator only when the outward verified answer contains:
- **at least 2 verified claims**, and
- those counted claims collectively cite **at least 2 unique authorized supporting sources**.

An `OK` response below either floor is classified by the **benchmark artifact** as `OK_THIN`: it remains an application-level `ok:true, code:OK` response and remains visible in the raw outcome/usefulness report, but contributes **zero** to the acceptance numerator. `OK_THIN` is not a new API/outcome code and requires no production contract change. The benchmark derives the source floor by mapping returned accepted-claim `evidence_ids` to returned authorized evidence objects and counting **distinct non-empty `work_id` values**; distinct `evidence_id` values alone do not satisfy the floor. The frozen harness specification defines the integrity behavior for missing/ambiguous mappings. This floor is a pilot-usefulness rule, not a checker-threshold change.

For every `OK`/`OK_THIN` response report, per domain and language stratum, the distribution of verified-claim count and unique-supporting-source count, including the existing single-source-verified-answer diagnostic where available. Do not infer unique support from citation count alone.

The denominator is always all 30 frozen held-out questions for that domain. Grounding rejection, provider/retrieval failure, malformed output, timeout/error, or another fail-closed no-answer outcome is not a verified answer and remains in the denominator.

### Frozen domain eligibility threshold

A domain is eligible for inclusion in the declared pilot scope only if:

**verified_answer_rate >= 70% (at least 21/30 held-out queries).**

This threshold is frozen before held-out results. It may not be relaxed after results are observed.

**Pre-result product rationale for 70%.** Golden Set v1 is a pilot-scope screen, not D-022 checker safety certification and not a claim of domain-wide research reliability. For a small supervised university-library pilot, the product owner requires a clear majority with margin above a bare 50% success rate while still allowing a deliberately fail-closed experimental system to reject difficult questions. With 30 frozen questions/domain, 70% maps to an auditable integer gate of 21 successes. The threshold is intentionally applied separately by domain and is paired with transparent rejection rates, Wilson uncertainty, and blind rejection audit; it must not be marketed as “70% accurate.” A future broader/public release requires a separately preregistered standard rather than inheriting this pilot threshold automatically.

Report exact numerator/denominator and a two-sided 95% Wilson interval as uncertainty context. The 70% point threshold is the v1 product decision rule; the confidence interval is reported and must not be hidden, but is not a second unregistered pass/fail rule.

There is no cross-domain averaging. Strong performance in one domain cannot compensate for a failing domain.

If a domain fails, the valid v1 outcome is to exclude/limit that domain in the pilot scope under #536/#399. A failed domain is not permission to weaken verification.

## Secondary system metrics

For every held-out query record content-free:
- final outcome code;
- first-attempt outcome code and whether an evaluation timeout retry occurred;
- retrieved/relevant/language-eligible/authorized counts;
- evidence-depth counts;
- eligible/checked/verified claim counts;
- grounding rejection reason counts, including support-check budget truncation separately;
- discover, generation, grounding/support-check and total latency;
- #579 support-check call-duration and application queue-wait diagnostics;
- exact candidate/config identity;
- `verification_reused`.

Report per-domain and overall distributions, plus truncation counts/rates by domain and language so generation beyond the four-check cap is not misread as checker rejection. Do not invent a composite quality score.

## Blind human audit of checker rejections

Checker acceptance rate alone is not sufficient evidence. A blind human audit distinguishes genuinely unsupported generated claims from plausible checker false negatives.

### Audit population

After the held-out run, form the population of claims rejected specifically by semantic support checking (`CLAIM_UNSUPPORTED` / support-check negative decision). Transport errors, language-policy failures, malformed checker responses, and claims rejected before semantic checking are reported separately and are not silently relabeled as semantic negatives.

For each domain:
- if there are <=20 eligible rejected claims, audit all of them;
- if there are >20, select exactly 20 using a preregistered deterministic hash ranking over frozen run ID + audit seed + claim ID.
- the audit seed is supplied only after the run artifact is frozen.

### Rater qualification, seed custody, blinding and rubric

Use **two independent human raters** for every sampled item. Before ratings begin, record a qualification statement for each rater:
- biomedical items require at least one rater with demonstrated biomedical/life-science research competence, and the second rater must be able to assess scholarly evidence in that domain;
- humanities/social-science items require raters able to assess scholarly evidence in the relevant broad domain;
- every Turkish item must be rated by two raters competent to read the Turkish claim/question context and the supplied scholarly evidence.

Raters must not be the implementer who tuned the measured candidate and must not have access to held-out system outcomes before their ratings are locked.

The deterministic audit seed is supplied by the maintainer/product owner or independent reviewer — **never by the implementer** — only after the complete held-out raw run artifact and eligible-rejection population have been frozen and hashed. Record the artifact hash, seed provider, seed, and sampling-script revision before opening the sampled items to raters.

Each rater locks their rating before seeing the other rater's output. Raters receive the claim and the exact evidence supplied to the checker, but not:
- checker decision/reason;
- domain acceptance result;
- retrieval configuration label beyond what is needed to interpret evidence;
- implementer diagnosis.

Each item is rated:
- `SUPPORTED`: every material factual component is supported by supplied evidence;
- `PARTIALLY_SUPPORTED`: a supported core exists but at least one material component is not established;
- `UNSUPPORTED`: supplied evidence does not support the material claim;
- `UNRATABLE`: evidence/rendering defect prevents a judgment.

Primary human-audit classification uses **exact agreement only**:
- both raters `SUPPORTED` -> consensus-supported apparent checker false negative;
- both raters `PARTIALLY_SUPPORTED` -> consensus-partial;
- both raters `UNSUPPORTED` -> consensus-unsupported;
- any disagreement, or any `UNRATABLE`, remains a separate challenge/unratable stratum and is not post-hoc adjudicated inside v1.

For the false-negative diagnostic, only consensus-`SUPPORTED` among semantic checker rejects counts as an apparent checker false negative. Report numerator/denominator by domain with Wilson interval and report raw rater agreement plus challenge/unratable counts. `PARTIALLY_SUPPORTED` remains separate and is not promoted to supported.

This audit is diagnostic and cannot override the primary query-level product gate in v1. A concerning false-negative pattern may justify a separately preregistered checker/calibration investigation, but checker thresholds/pins are not changed inside this round.

## Biomedical unsupported-claim classification

For every biomedical semantic rejection in the held-out run, record a content-free classification after blind evidence review:
1. evidence depth insufficient for the generated claim;
2. claim materially more specific than the supplied abstract/evidence;
3. evidence topically relevant but does not establish the claim;
4. substantive retrieval/evidence mismatch;
5. other/unratable.

Report counts and denominators. Categories 1–3 test the #495/#536 abstract-depth and claim-specificity hypotheses quantitatively. Preserve examples only in a restricted review artifact if needed; Admin/telemetry remains content-free.

## Infrastructure-failure rerun policy

A held-out question receives **at most one retry**, and for Golden Set v1 the only retry-eligible public rejection reason is `SUPPORT_CHECK_FAILED_TIMEOUT`. Eligibility is row-level: **every** rejection/failure on the first attempt must be `SUPPORT_CHECK_FAILED_TIMEOUT`; any mixed semantic, policy, evidence, budget, malformed-response, provider, transport catch-all, or other reason makes the row non-retryable. In particular, `CLAIM_UNSUPPORTED`, `SUPPORT_CHECK_FAILED_BUDGET`, `SUPPORT_CHECK_FAILED_TRANSPORT_OR_OTHER`, language/pin failures, retrieval/evidence insufficiency, malformed model/checker content, support-check truncation, and `OK_THIN` are **not** retry-eligible. Internal exception names or operator judgment may not expand this class during v1.

For a retry-eligible row:
- preserve both attempt records and the original failure code/timings;
- retry the identical frozen question and candidate/config once, with no intervention or tuning between attempts;
- the second attempt is the row's product outcome for the primary gate;
- if the retry is also an infrastructure failure, the row is a fail-closed non-success in the denominator; no third attempt;
- report first-attempt and final timeout counts per domain/language next to verified-answer rates.

A systemic infrastructure pattern is defined before results as either **2 consecutive held-out first-attempt retry-eligible timeouts**, or, after at least **5 first attempts in a domain x language cell**, **>=40% first-attempt timeout rows** in that cell. Evaluate this immediately after each first attempt and before an evaluation retry. If triggered, stop the round, preserve artifacts and teardown; do not consume further held-out rows/retries. A timeout/concurrency/capacity change requires a successor freeze/version.

Because the product support-check path does not automatically retry timeout failures, the final report also shows the **first-attempt-only qualifying-answer rate** per domain/language as a non-gating sensitivity figure alongside the retry-policy product outcome.

## Cache and run integrity

Measured acceptance runs MUST have verified-result cache disabled at the deployed staging configuration **and** verified disabled immediately before the first measured request. The benchmark-window staging config PR must set `RESEARCH_VERIFIED_RESULT_CACHE_ENABLED = "false"`; the post-benchmark rollback restores its prior staging value.

For every held-out row:
- `verification_reused === false` is mandatory;
- any row with reuse true invalidates that row and the round must stop pending review;
- no cached answer may substitute for Fresh-Checker execution.

Do not alter production cache behavior. This is a staging benchmark condition only.

## Checker-call budget and staging schedule

Repository configuration at preregistration time has separate ceilings: **staging = 100 supportCheck invocations per UTC day** and **production = 300/day**. The runtime KV limit may only lower the environment ceiling; it cannot raise it.

The held-out set can require up to 90 × 4 = 360 supportCheck invocations on first attempts, before the bounded #579 latency sample and smoke/error margin. The one-retry infrastructure policy can add calls, so **500 is not asserted to cover every theoretical retry case**. To complete the frozen benchmark promptly without removing a cost bound, the product owner authorizes a **temporary staging-only hard ceiling of 500 supportCheck invocations per UTC day for the Golden Set v1 measurement window**.

If the remaining daily budget cannot safely cover the next frozen row (including its possible retry), stop before that row, teardown the endpoint, and resume the untouched remainder in a later UTC-day checker-on window. Do not raise the 500 ceiling, drop rows, reorder based on observed outcomes, or consume partial rows merely to finish in one day.

This authorization does **not** change:
- production's 300/day ceiling;
- #399's production/pilot capacity assumption;
- checker thresholds, pins, fail-closed behavior, or support-check concurrency;
- the requirement to account for actual calls/cost.

Before execution:
1. change only the staging environment ceiling from 100 to 500 through a reviewed config PR;
2. deploy the exact reviewed staging candidate;
3. set/verify the runtime staging limit at <=500 as required for the run;
4. record the effective limit in the run artifact.

After the Golden Set v1/#579 measurement window:
1. teardown the checker endpoint;
2. complete the mandatory rollback tracked in **#583**: restore the staging hard ceiling to 100 **and restore the pre-benchmark staging verified-result-cache setting** through the normal reviewed path;
3. verify the effective runtime limit no longer exceeds the restored ceiling and verify the cache setting matches the pre-benchmark state.

The 500 ceiling is headroom, not a target. Stop the run after the frozen work completes; unused capacity must not be consumed.

## Capacity parity and acceptance interpretation

The pilot capacity boundary in #399 is **2 x ml.m5.large / 300 supportCheck invocations per UTC day**. Golden Set v1 acceptance MUST therefore run with the Fresh-Checker endpoint at the same **2 x ml.m5.large** instance shape if the results are to support #399 pilot-scope authorization directly.

At preregistration time, the repository's staging lifecycle deploy workflow sets `SAGEMAKER_INITIAL_INSTANCE_COUNT='1'`. Therefore acceptance execution is blocked until a separate reviewed **staging-only lifecycle change** makes the deploy/verify path explicitly create and verify 2 x ml.m5.large for this acceptance window. That infrastructure change must not alter production capacity and must be included in the exact-candidate/run evidence.

If the reviewed staging lifecycle cannot deploy/verify that exact 2-instance shape, do **not** reinterpret a 1-instance acceptance run as pilot-parity evidence. A 1-instance run may be retained only as diagnostic evidence; pilot-scope acceptance must be re-confirmed on the 2-instance shape under the same frozen candidate/protocol (or a separately preregistered successor if another material candidate/config change is required).

Record endpoint instance type/count in the candidate fingerprint and run artifact. The temporary staging 500/day ceiling is benchmark headroom and does not alter the production/pilot 300/day boundary.

## Combined #579 + golden-set staging window

To minimize endpoint uptime and teardown risk, each checker-on window follows:

1. deploy/verify staging Fresh-Checker;
2. confirm exact frozen candidate/config and cache OFF;
3. confirm the **pre-freeze development-set #579 latency calibration** and its frozen timeout/concurrency decision are recorded; do not rerun #579 on held-out questions as a tuning step;
4. run the scheduled golden-set shard while daily invocation budget permits;
5. preserve content-free raw results and run IDs;
6. teardown the endpoint in the same window;
7. verify teardown before considering the window complete.

Do not leave the endpoint running between shards/days.

#579 latency interpretation must distinguish individual call duration from application-level concurrency wait. If evidence supports a concurrency or instance/capacity change, stop and reconcile the proposal with #399's fixed 2 × ml.m5.large / 300 supportCheck invocations per UTC day boundary and recalculate cost before any authorization.

## Pilot UX linkage

The later pilot UI/polish work MUST consume Golden Set/#399 scope evidence rather than inventing examples or coverage claims:

- clickable example questions may be selected only from questions/use cases demonstrated as supported by the accepted evidence and authorized pilot scope; do not feature an unvalidated humanities/biomedical/engineering example merely because it reads well;
- retain a small, truthful `Pilot` / `Experimental` maturity label and a concise declared-scope statement while Research remains pre-1.0;
- remove developer-facing fixture/safe-boundary prose from the pilot UI, but preserve the fail-safe behavior that does not show fixture content when no real verified answer exists;
- the same UI review MUST include the #399 item-13 rejected-query experience, distinguishing at minimum an evidence/verification rejection from a system/service failure without implying that a rejected claim is false;
- Turkish interface copy and Turkish-query behavior must be reviewed against the frozen Turkish strata before pilot authorization.

## Decision matrix

For each domain:
- **DOMAIN PASS (>=21/30):** eligible to be named in the proposed pilot scope, subject to the rest of #399.
- **TURKISH-SUPPORTED PASS:** requires both DOMAIN PASS and >=7/10 on that domain's frozen Turkish stratum before the product may claim Turkish support for that domain.
- **DOMAIN FAIL (<21/30) or TURKISH FAIL (<7/10):** exclude or explicitly limit the corresponding domain/language scope; document rejected-query UX under #399 item 13.
- **INVALID:** protocol/candidate/cache/blinding integrity failure; no product conclusion. Close the round and preregister a successor.

A limited-domain pilot is a legitimate outcome, not a failed project.

## Required artifacts before held-out execution

1. this independently reviewed preregistration;
2. development-set manifest;
3. reviewer/product-owner-frozen held-out provenance plan, followed by the sealed held-out question manifest and hash;
4. question-construction/diversity QA and author-independence record;
5. exact candidate/config fingerprint;
6. frozen harness and raw-results schema;
7. human-audit sampling script/spec, rater qualification statements, two-rater assignment/blinding record, seed-custody record template, and rating form;
8. daily call-budget/shard plan;
9. endpoint-shape evidence showing the acceptance run will use 2 x ml.m5.large, or an explicit diagnostic-only designation if parity is unavailable;
10. reviewer sign-off that no held-out results were inspected before freeze.

No held-out execution and no production authorization is implied by merging this design document.
