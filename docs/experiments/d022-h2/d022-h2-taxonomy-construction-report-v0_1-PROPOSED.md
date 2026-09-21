# D-022 supportCheck - H2 Reasoning-Template Taxonomy v0.1 (PROPOSED)

Role: H2 Reasoning-Template Taxonomy Author (Claude Opus 5).
Status: `PROPOSED / INDEPENDENT REVIEW REQUIRED`

Authorized inputs used, and only these:
- `d022-supportcheck-h2-preregistration-v0.1.md`
- `d022-supportcheck-h2-construction-rating-spec-v0.1.md`
- FINAL/LOCKED `d022-h1-structural-inventory.jsonl` (30 entries H1T001-H1T030; 720 claim IDs, all unique; SHA-256 of the file as supplied: `a08da438f43b023d9eea73cf4378bbb7bc529e450e6fef16afb894d8e8f9a468`)

Only the `template_id`, `transformation` and `claim_ids` fields of the inventory were used. Claim IDs were used solely for coverage/uniqueness verification and for locating which abstract transformations are occupied; no H1 claim text, rating, consensus row, semantic outcome label or author_intent value was requested, supplied, inspected or reconstructed.

## A. Proposed canonical taxonomy

File: `d022-h2-reasoning-template-taxonomy-v0_1-PROPOSED.jsonl`

- one JSON object per line, UTF-8 without BOM, NFC, compact separators, keys sorted, LF only, lexicographic `template_id` ordering, single final LF, no blank lines;
- 98 entries, 141387 bytes; SHA-256 of the bytes as produced: `40f6f57635f131bedf9fd5404aedd58b8618208ba81d91fbe97c4124d0c823f2`;
- each entry contains exactly: `claim_transformation`, `evidence_condition`, `exclusion_rule`, `h1_non_equivalence`, `inclusion_rule`, `target_pool`, `template_id`.

The hash above is provided for reference only; the canonical hash of record is computed by the validator after mechanical canonicalization at merge time.

## B. Pool summary

| target_pool | templates | required minimum | template IDs |
| --- | --- | --- | --- |
| U1 | 12 | 12 | H2T001, H2T002, H2T003, H2T004, H2T005, H2T006, H2T007, H2T008, H2T009, H2T010, H2T011, H2T012 |
| U2 | 12 | 12 | H2T013, H2T014, H2T015, H2T016, H2T017, H2T018, H2T019, H2T020, H2T021, H2T022, H2T023, H2T024 |
| U3 | 12 | 12 | H2T025, H2T026, H2T027, H2T028, H2T029, H2T030, H2T031, H2T032, H2T033, H2T034, H2T035, H2T036 |
| U4 | 12 | 12 | H2T037, H2T038, H2T039, H2T040, H2T041, H2T042, H2T043, H2T044, H2T045, H2T046, H2T047, H2T048 |
| U5 | 12 | 12 | H2T049, H2T050, H2T051, H2T052, H2T053, H2T054, H2T055, H2T056, H2T057, H2T058, H2T059, H2T060 |
| U6 | 12 | 12 | H2T061, H2T062, H2T063, H2T064, H2T065, H2T066, H2T067, H2T068, H2T069, H2T070, H2T071, H2T072 |
| SUPPORTED | 14 | 12 | H2T073, H2T074, H2T075, H2T076, H2T077, H2T078, H2T079, H2T080, H2T081, H2T082, H2T083, H2T084, H2T085, H2T086 |
| PARTIAL | 12 | 12 | H2T087, H2T088, H2T089, H2T090, H2T091, H2T092, H2T093, H2T094, H2T095, H2T096, H2T097, H2T098 |

Total proposed templates: 98.

### Concentration-cap feasibility (construction capability check, not an assignment)

| pool | candidates to fill | frozen per-template cap | templates x cap | feasible |
| --- | --- | --- | --- | --- |
| U1 | 120 | 12 of 120 | 144 | yes |
| U2 | 120 | 12 of 120 | 144 | yes |
| U3 | 120 | 12 of 120 | 144 | yes |
| U4 | 120 | 12 of 120 | 144 | yes |
| U5 | 120 | 12 of 120 | 144 | yes |
| U6 | 120 | 12 of 120 | 144 | yes |
| SUPPORTED | 240 | 10% of pool = 24 | 336 | yes |
| PARTIAL | 120 | 10% of pool = 12 | 144 | yes |

The taxonomy is closed: per the frozen construction specification it may not be expanded, split, merged, renamed or moved between pools after H2 authorship begins. Headroom above the minimum is therefore deliberate but bounded; the caps remain binding on the author, and exhausting them during construction is a construction failure, not grounds for taxonomy amendment.

### Frozen sub-composition coverage

PARTIAL is balanced 20/20/20/20/20/20 across the six frozen subtypes. Two structurally distinct templates are supplied per subtype, so each subtype can be filled (2 x 12 = 24 >= 20) without exceeding the 12-per-template cap:

- scope: H2T087, H2T088
- mechanism: H2T089, H2T090
- temporal extrapolation: H2T091, H2T092
- conflict resolution: H2T093, H2T094
- evaluative strengthening: H2T095, H2T096
- denominator/generalisation: H2T097, H2T098

SUPPORTED templates able to carry each frozen composition category (categories may overlap only where the inherited H1 rule allows one claim to satisfy several characteristics; the construction QA summary must still report both category memberships and unique-claim counts):

- numeric/bounded (>=48): H2T073, H2T074, H2T075, H2T079
- multi-evidence synthesis (>=48): H2T076, H2T077, H2T078, H2T086
- explicit uncertainty/limitation (>=32): H2T079, H2T080, H2T082
- conflict-aware (>=32): H2T081, H2T082
- explicit negative/absence (>=32): H2T083, H2T084
- direct factual synthesis (remaining 48): H2T085, H2T076, H2T086

U2, U3, U4 and U6 sub-composition minima (>=60/120 each) are satisfiable: all twelve U2 templates turn on a denominator, base or population boundary; all twelve U3 templates require evidence that does not explicitly establish the asserted causal relation; all twelve U4 templates are bounded extensions that stay tied to an explicitly stated boundary; and all twelve U6 templates are designed for high lexical overlap because the claim reuses the evidence's own vocabulary and numerals while substituting the asserted property.

## C. Pairwise-distinctness self-check

Distinctness was assessed across the whole taxonomy rather than within each pool, because the frozen rule states that moving a transformation to another target pool does not create a new transformation. Every PARTIAL extension operation and every SUPPORTED operation was therefore also checked against all 72 negative templates.

### C.1 Candidate templates merged before proposal

| merged candidates | retained as | reason |
| --- | --- | --- |
| instrument repeatability asserted as accuracy; inter-rater agreement asserted as label correctness | H2T061 | both perform one operation - a consistency statistic asserted as correspondence with truth; the difference was only the kind of agreement measured |
| screening detection rate asserted as prevalence; reported incident count asserted as occurrences | H2T064 | one operation - an ascertainment-channel figure asserted as the underlying frequency; the difference was only the channel |
| gross figure asserted as net; nominal/unadjusted figure asserted as adjusted | H2T069 | one operation - a raw numeral asserted as the evidence-defined adjusted variant; deduction versus normalisation is a domain difference, not an operational one |
| performance asserted beyond a tested numeric range; performance asserted at a larger scale/load | H2T039 | scale, load and capacity are instances of the same bounded quantitative parameter |
| pilot result asserted as routine operation; controlled/laboratory result asserted as field performance | H2T043 | one operation - crossing a single stated evaluation-setting boundary |
| overlapping multi-select categories summed; overlapping source counts summed | H2T014 | one operation - summing counts evidence marks as non-disjoint; the overlap's origin is surface |
| numeric restatement with qualifiers preserved; metric value extracted for a named condition | H2T085 (non-numeric only) | the numeric variant duplicated H1T016 and was dropped rather than merged; the retained template is restricted by its exclusion rule to non-numeric propositional content |

### C.2 Candidate templates removed before proposal

Removed either because they were a direct or mirrored structural equivalent of an H1 inventory entry, or because their distinctness from a retained H2 template rested on surface features.

| removed candidate | reason |
| --- | --- |
| conflict resolved by treating the more authoritative source as correct | value-selection operation already occupied by H1T003; the precedence idea survives only as H2T094, where no value is selected and the asserted content is an institutional precedence property |
| bounded observation extended backwards to an earlier period | direction-only mirror of H1T017; temporal direction is not a new operation. The backward axis survives only as H2T092, whose asserted content is an onset date or duration attached to a traceable core |
| rate converted into an absolute count with no base | direction-only mirror of H1T025; replaced by H2T013 and H2T018, which are different arithmetic operations (cross-population transfer and precision reconstruction) |
| ordinal rank converted into a magnitude gap | inverse of H1T024 along the same axis |
| sample figure asserted as a census count | structurally equivalent to H1T001 and H1T018 |
| training completion asserted as demonstrated competence | noun-only variation on H1T022 (completion asserted as an unmeasured attribute of completers) |
| interval endpoint asserted as the point value | overlapped H2T047 and the supported bound template H2T074; the U1 slot was reassigned to H2T009 |
| absence of recorded complaints asserted as conformity | fell inside the H1T020/H1T027 absence-to-positive-attribute family and overlapped H2T030 |
| forecast asserted as a guarantee | modal upgrade already covered by H2T001, with the epistemic component covered by H2T032 |
| conflicting estimates asserted as an established interval | overlapped H2T049 (arithmetic combination of conflicting values) and H2T074 |
| capacity or licensed limit asserted as realised utilisation | overlapped H2T007 (planned value asserted as realised) and H2T066 |
| stated plan or commitment asserted as completed activity | overlapped H2T007; retained only in its numeric form there |
| conflicting qualitative classifications merged into a consensus label | overlapped H2T050 (asserted concordance) |
| usage volume asserted as user endorsement | volume-to-evaluative operation occupied by H1T004 and H1T024 |

### C.3 Close pairs considered and retained as structurally distinct

| pair | why they are different operations |
| --- | --- |
| H2T005 / H2T017 | H2T005 relabels one numeral as a different named statistic with no computation; H2T017 computes a new aggregate across reported groups and its defect is the omission of stated weights |
| H2T007 / H2T042 / H2T069 | three different status upgrades on an unchanged numeral: prospective to realised; provisional to final; raw to the defined adjusted variant. Each requires a different explicit marker in evidence and each exclusion rule names the other two |
| H2T009 / H2T033 / H2T072 | H2T009 deletes an attribution marker from a descriptive statement; H2T033 converts a reported belief into causation; H2T072 upgrades a positive listing fact into a vetting act |
| H2T012 / H2T034 / H2T083 / H2T084 | existence of a property from non-detection; nullity of a causal effect from an inconclusive estimate; a pack-scoped silence assertion; and restatement of an affirmatively stated negative finding. The first two are negatives, the last two supported |
| H2T013 / H2T023 / H2T024 | multiplying a rate by a foreign population's size; inverting a conditional's direction with the numeral fixed; and asserting a normalised figure where no base exists anywhere |
| H2T014 / H2T020 / H2T060 | summing counts evidence marks as overlapping; deriving a joint quantity from separate marginals; and adding two totals that each claim the same full scope |
| H2T015 / H2T018 | scale conversion of a stated difference versus reconstruction of false precision by inverting an explicitly rounded share |
| H2T016 / H2T045 | re-binding a numeral between two accounting windows evidence both names, versus asserting a reported aggregate as the value of an interior sub-period where variation is stated |
| H2T010 / H2T025 | H2T010 exchanges the arguments of a stated non-causal relation; H2T025 inverts the direction of an asserted causal relation |
| H2T026 / H2T030 | a quantified counterfactual magnitude versus an unquantified preventive attribution anchored on an explicitly reported non-event; each exclusion rule routes to the other |
| H2T027 / H2T039 | a causal dose-response law across unobserved intensities versus a descriptive performance assertion at an out-of-range parameter value |
| H2T029 / H2T043 / H2T048 | transporting a causal effect to a named setting; asserting a controlled result as routine operation; transferring a descriptive value on a stated similarity between entities |
| H2T031 / H2T068 | asserting that one measured series drives another from their ordering, versus converting a single-occasion between-group difference into a temporal change with no causal content |
| H2T036 / H2T089 | crediting one enumerated delivered component for an aggregate result, versus asserting that a traceable outcome conforms to a separately stated design intent |
| H2T037 / H2T045 / H2T092 | continuity across an explicitly unmeasured interior gap; an aggregate asserted for an interior sub-period; and an asserted onset or duration extending before the measurement |
| H2T046 / H2T057 / H2T070 | partial criteria asserted as whole-standard conformity; stated conditions deleted from a decision; documented adherence asserted as objective attainment |
| H2T047 / H2T005 | shifting a value's position in the observed distribution from extremum to typical, versus relabelling the named statistic while asserting no typicality |
| H2T049 / H2T053 / H2T060 | three distinct resolution operations over conflicting values: arithmetic midpoint; source-frequency warrant; additive combination |
| H2T050 / H2T082 / H2T093 | asserting the sources agree; asserting the pack cannot adjudicate them; and asserting the discrepancy is immaterial to a traceable conclusion. The first is a false meta-claim, the second is supported, the third is a partial extension against an absent threshold |
| H2T051 / H2T052 / H2T056 | asserting an unstated cause of a discrepancy; asserting one figure is defective; and treating figures evidence explicitly defines differently as one quantity |
| H2T054 / H2T042 / H2T058 | asserting an open discrepancy is settled; asserting provisional results are final; and disregarding an explicit invalidation marker |
| H2T061 / H2T063 | consistency asserted as correctness, versus statistical detectability asserted as practical importance |
| H2T064 / H2T066 | an ascertainment channel's count asserted as the true frequency, versus a count moved one stage along a process pipeline from entitlement to receipt |
| H2T065 / H2T067 | a subject's stated intention asserted as realised behaviour, versus a norm asserted as factual practice |
| H2T071 / H2T088 | H2T071 substitutes a behavioural property for the measured attitudinal one and leaves no traceable core; H2T088 retains the measured result and conjoins a second unmeasured dimension |
| H2T073 / H2T076 / H2T085 | arithmetic derivation over evidence-stated disjoint parts; conjunction of two items under explicit identity; and single-sentence restatement with qualifiers preserved |
| H2T074 / H2T079 / H2T081 | asserting only a stated bound; asserting a value with its stated uncertainty; and asserting a consequence that holds under every conflicting value |
| H2T087 / H2T097 / H2T098 | three different unestablished properties appended to a traceable core: exhaustiveness of an enumeration; representativeness of the measured group; completeness of the base |
| H2T095 / H2T096 / H2T063 | an absolute adequacy verdict; a prescriptive recommendation; and a practical-importance substitution. The first two retain a traceable core, the third replaces the asserted property |
| H2T003 / H2T089 | re-attributing a stated act to a different named actor, versus asserting that a traceable outcome occurred by design |

No pair in the proposed taxonomy is separated only by topic, entity, noun choice, numeric value, domain, wording, polarity or target pool. Where a residual risk was judged to exist, the templates' exclusion rules name each other explicitly so that an independent reviewer can route any candidate record to exactly one template.

## D. H1 non-equivalence self-check

Every proposed template was compared against all 30 FINAL/LOCKED H1 inventory entries. The table below names the closest H1 entries for each template together with the H2 operation; the full non-equivalence statement is carried in the `h1_non_equivalence` field of each record.

| H2 template | pool | closest H1 entries | H2 evidence -> claim operation |
| --- | --- | --- | --- |
| H2T001 | U1 | H1T011, H1T019 | permissive operator replaced by an obligation operator |
| H2T002 | U1 | H1T016, H1T019 | value re-bound to a different named measurement method |
| H2T003 | U1 | H1T003, H1T014 | act re-attributed to a different named actor |
| H2T004 | U1 | H1T021, H1T029 | reporting/recording predicate replaced by an occurrence predicate |
| H2T005 | U1 | H1T025, H1T030 | numeral relabelled as a different named summary statistic |
| H2T006 | U1 | H1T013, H1T018 | stated bound replaced by a relation the bound does not determine |
| H2T007 | U1 | H1T017, H1T022 | planned/target value asserted as the realised measurement |
| H2T008 | U1 | H1T012, H1T025 | count re-bound to a different counted unit type |
| H2T009 | U1 | H1T020, H1T027 | attribution/provenance marker deleted |
| H2T010 | U1 | H1T007, H1T023 | arguments of an asymmetric relation exchanged |
| H2T011 | U1 | H1T019, H1T026 | outcome re-bound to another named condition (lateral, not universal) |
| H2T012 | U1 | H1T020, H1T022, H1T027 | non-detection asserted as established absence |
| H2T013 | U2 | H1T001, H1T030 | rate from population A multiplied by the size of population B |
| H2T014 | U2 | H1T025, H1T028 | explicitly overlapping counts summed as an unduplicated total |
| H2T015 | U2 | H1T013, H1T025 | difference restated in the other scale without the base |
| H2T016 | U2 | H1T017, H1T028 | numeral re-bound between cumulative and single-period windows |
| H2T017 | U2 | H1T001, H1T026 | unweighted mean of unequal groups asserted as the population value |
| H2T018 | U2 | H1T025, H1T030 | exact count back-computed from an explicitly rounded share |
| H2T019 | U2 | H1T012, H1T030 | exposure denominator replaced by a headcount denominator |
| H2T020 | U2 | H1T018, H1T028 | joint quantity derived from separately reported marginals |
| H2T021 | U2 | H1T025, H1T030 | numerator and denominator taken from different hierarchy levels |
| H2T022 | U2 | H1T018, H1T022 | quantified missing values absorbed into a substantive category |
| H2T023 | U2 | H1T026, H1T030 | conditional share asserted in the inverted direction |
| H2T024 | U2 | H1T004, H1T025 | normalised per-unit figure asserted with no base in the pack |
| H2T025 | U3 | H1T005, H1T008 | causal direction inverted |
| H2T026 | U3 | H1T005, H1T008 | quantified counterfactual asserted with no comparator |
| H2T027 | U3 | H1T005, H1T017 | dose-response law asserted from one exposure level |
| H2T028 | U3 | H1T001, H1T008 | group-level association asserted as individual-level causation |
| H2T029 | U3 | H1T005, H1T019 | causal effect transported to another named setting |
| H2T030 | U3 | H1T011, H1T015 | non-event under a safeguard asserted as prevention |
| H2T031 | U3 | H1T005, H1T008, H1T021 | lead-lag ordering of two series asserted as driving |
| H2T032 | U3 | H1T005, H1T006 | modelled/simulated relation asserted as real-world causation |
| H2T033 | U3 | H1T006, H1T008, H1T011 | reported belief/attribution asserted as causal fact |
| H2T034 | U3 | H1T013, H1T014 | inconclusive estimate asserted as a null effect |
| H2T035 | U3 | H1T009, H1T015 | surrogate movement asserted as final-outcome causation |
| H2T036 | U3 | H1T006, H1T008 | aggregate bundle result credited to one enumerated component |
| H2T037 | U4 | H1T017, H1T029 | continuity asserted across an explicitly unmeasured interior gap |
| H2T038 | U4 | H1T002, H1T019 | result carried across a stated version/revision boundary |
| H2T039 | U4 | H1T017, H1T019 | performance asserted at a point outside the tested range |
| H2T040 | U4 | H1T001, H1T018 | figure extended across a stated cohort closure to later members |
| H2T041 | U4 | H1T007, H1T019 | individually tested components composed into a combined configuration |
| H2T042 | U4 | H1T010, H1T017 | interim/provisional results asserted as final |
| H2T043 | U4 | H1T011, H1T019 | controlled/pilot result asserted as routine operation |
| H2T044 | U4 | H1T001, H1T019, H1T026 | result asserted for an explicitly excluded category |
| H2T045 | U4 | H1T001, H1T026 | window aggregate asserted as a named interior sub-period value |
| H2T046 | U4 | H1T018, H1T027 | partial criteria satisfaction asserted as whole-standard conformity |
| H2T047 | U4 | H1T017, H1T024 | peak observation asserted as sustained/typical capability |
| H2T048 | U4 | H1T001, H1T019 | value transferred on a stated similarity between distinct entities |
| H2T049 | U5 | H1T002, H1T003 | conflicting values averaged into a new figure |
| H2T050 | U5 | H1T014, H1T023 | disagreeing sources asserted to agree |
| H2T051 | U5 | H1T003, H1T005 | unstated cause asserted for the discrepancy |
| H2T052 | U5 | H1T002, H1T003 | one conflicting figure asserted to be erroneous |
| H2T053 | U5 | H1T003, H1T014 | majority source count used as the resolution rule |
| H2T054 | U5 | H1T010, H1T023 | explicitly open discrepancy asserted as resolved |
| H2T055 | U5 | H1T003, H1T028 | total/components arithmetic inconsistency asserted away |
| H2T056 | U5 | H1T007, H1T013 | definitionally different figures treated as one quantity |
| H2T057 | U5 | H1T014, H1T027 | conditional decision asserted as unconditional |
| H2T058 | U5 | H1T002, H1T003 | explicit retraction/supersession marker disregarded |
| H2T059 | U5 | H1T002, H1T023 | unreconciled cross-time conflict converted into a trend |
| H2T060 | U5 | H1T003, H1T028 | conflicting totals summed as complementary parts |
| H2T061 | U6 | H1T004, H1T015 | reliability/agreement statistic asserted as accuracy/validity |
| H2T062 | U6 | H1T004, H1T011, H1T024 | cost figure asserted as cost-effectiveness (missing benefit term) |
| H2T063 | U6 | H1T013, H1T024 | statistical detectability asserted as practical importance |
| H2T064 | U6 | H1T012, H1T022 | ascertainment-channel count asserted as true prevalence |
| H2T065 | U6 | H1T011, H1T022 | stated intention asserted as realised behaviour |
| H2T066 | U6 | H1T011, H1T025 | eligibility count asserted as receipt/enrolment count |
| H2T067 | U6 | H1T019, H1T027 | normative requirement asserted as factual practice |
| H2T068 | U6 | H1T005, H1T007 | cross-sectional between-group difference asserted as over-time change |
| H2T069 | U6 | H1T025, H1T030 | raw/gross numeral asserted as the defined adjusted/net figure |
| H2T070 | U6 | H1T011, H1T015 | documented adherence asserted as objective attainment |
| H2T071 | U6 | H1T012, H1T022 | attitudinal rating asserted as behavioural loyalty |
| H2T072 | U6 | H1T020, H1T027 | listing/registration asserted as vetting/endorsement |
| H2T073 | SUPPORTED | H1T007, H1T028 | derived sum/difference over evidence-stated disjoint parts |
| H2T074 | SUPPORTED | H1T016, H1T023 | assertion confined to an evidence-stated bound |
| H2T075 | SUPPORTED | H1T007, H1T013 | ordering-only assertion across three or more listed values |
| H2T076 | SUPPORTED | H1T028, H1T029 | cross-item conjunction under explicit identity |
| H2T077 | SUPPORTED | H1T010, H1T016 | reference resolution through an explicit identifier link |
| H2T078 | SUPPORTED | H1T007, H1T016 | evidence-stated categorical rule applied to a stated instance |
| H2T079 | SUPPORTED | H1T016, H1T029 | value asserted with the source's stated uncertainty intact |
| H2T080 | SUPPORTED | H1T010, H1T029 | result asserted within a stated methodological limitation |
| H2T081 | SUPPORTED | H1T003, H1T023 | conflict-invariant consequence asserted without resolving |
| H2T082 | SUPPORTED | H1T010, H1T023 | non-determination of a conflict asserted |
| H2T083 | SUPPORTED | H1T010, H1T029 | pack-scoped silence asserted |
| H2T084 | SUPPORTED | H1T010, H1T029 | evidence-stated negative finding restated with scope |
| H2T085 | SUPPORTED | H1T016, H1T028 | non-numeric fact restated with all qualifiers preserved |
| H2T086 | SUPPORTED | H1T021, H1T029 | chronological relation between two stated dates |
| H2T087 | PARTIAL | H1T001, H1T018 | core + enumeration asserted exhaustive |
| H2T088 | PARTIAL | H1T011, H1T015 | core + equivalent performance on an unmeasured dimension |
| H2T089 | PARTIAL | H1T005, H1T006 | core + outcome asserted to be by design |
| H2T090 | PARTIAL | H1T006, H1T008 | core + stated factor asserted to explain the residual |
| H2T091 | PARTIAL | H1T017, H1T029 | core + quantified future projection |
| H2T092 | PARTIAL | H1T017, H1T021 | core + asserted onset date or duration |
| H2T093 | PARTIAL | H1T003, H1T023 | core + discrepancy asserted immaterial |
| H2T094 | PARTIAL | H1T002, H1T003 | core + one source asserted authoritative |
| H2T095 | PARTIAL | H1T004, H1T024 | core + absolute adequacy verdict against no stated criterion |
| H2T096 | PARTIAL | H1T011, H1T024 | core + prescriptive recommendation |
| H2T097 | PARTIAL | H1T001, H1T026 | core + representativeness of a larger named population |
| H2T098 | PARTIAL | H1T025, H1T030 | core + completeness of the stated base |

### D.1 Reverse index - every H1 entry was compared

| H1 entry | H1 transformation | H2 templates that cite it as adjacent |
| --- | --- | --- |
| H1T001 | Apply a subgroup's result to the entire population | H2T013, H2T017, H2T028, H2T040, H2T044, H2T045, H2T048, H2T087, H2T097 |
| H1T002 | Arbitrarily choose the later entry as the correct value to resolve an unadjudicated conflict | H2T038, H2T049, H2T052, H2T058, H2T059, H2T094 |
| H1T003 | Arbitrarily select one source's value to resolve an explicit conflict without reconciliation | H2T003, H2T049, H2T051, H2T052, H2T053, H2T055, H2T058, H2T060, H2T081, H2T093, H2T094 |
| H1T004 | Assert a dataset is a high-quality benchmark based solely on its record count | H2T024, H2T061, H2T062, H2T095 |
| H1T005 | Assume causal mechanism from a simple pre/post change without causal design | H2T025, H2T026, H2T027, H2T029, H2T031, H2T032, H2T051, H2T068, H2T089 |
| H1T006 | Claim a specific internal mechanism produced a change without any mechanistic measurement | H2T032, H2T033, H2T036, H2T089, H2T090 |
| H1T007 | Compare two distinct conditions and their corresponding metric values | H2T010, H2T041, H2T056, H2T068, H2T073, H2T075, H2T078 |
| H1T008 | Conclude an intervention pathway is the sole reason for a change based only on correlation | H2T025, H2T026, H2T028, H2T031, H2T033, H2T036, H2T090 |
| H1T009 | Confirm an underlying diagnosis from an abnormal value without diagnostic tests | H2T035 |
| H1T010 | Confirm citation counts are unavailable due to an explicit note | H2T042, H2T054, H2T077, H2T080, H2T082, H2T083, H2T084 |
| H1T011 | Conflate simple availability with demonstrated effectiveness | H2T001, H2T030, H2T033, H2T043, H2T062, H2T065, H2T066, H2T070, H2T088, H2T096 |
| H1T012 | Conflate the number of respondents with the total number of enrollees who are satisfied | H2T008, H2T019, H2T064, H2T071 |
| H1T013 | Declare one protocol conclusively superior based on raw values without equivalence adjustment | H2T006, H2T015, H2T034, H2T056, H2T063, H2T075 |
| H1T014 | Disregard one reviewer's dissenting classification to assert a criterion was definitively met | H2T003, H2T034, H2T050, H2T053, H2T057 |
| H1T015 | Establish safety from a non-safety performance measurement | H2T030, H2T035, H2T061, H2T070, H2T088 |
| H1T016 | Extract metric value for a specific condition from a descriptive scope | H2T002, H2T074, H2T077, H2T078, H2T079, H2T085 |
| H1T017 | Extrapolate finite observed performance into indefinite long-term persistence | H2T007, H2T016, H2T027, H2T037, H2T039, H2T042, H2T047, H2T091, H2T092 |
| H1T018 | Falsely assert that all sampled records met a criterion when only a subset did | H2T006, H2T020, H2T022, H2T040, H2T046, H2T087 |
| H1T019 | Falsely claim a measurement applies across all operating conditions when scoped to one | H2T001, H2T002, H2T011, H2T029, H2T038, H2T039, H2T041, H2T043, H2T044, H2T048, H2T067 |
| H1T020 | Falsely claim an entity is highly cited and field-leading from a catalog record missing citation fields | H2T009, H2T012, H2T072 |
| H1T021 | Falsely claim the observation date caused the measured value | H2T004, H2T031, H2T086, H2T092 |
| H1T022 | Falsely show that all completers were satisfied when satisfaction was not reported | H2T007, H2T012, H2T022, H2T064, H2T065, H2T071 |
| H1T023 | Identify an unresolved numerical conflict between two sources | H2T010, H2T050, H2T054, H2T059, H2T074, H2T081, H2T082, H2T093 |
| H1T024 | Infer market/industry-leading status from a raw performance metric without comparative/market data | H2T047, H2T062, H2T063, H2T095, H2T096 |
| H1T025 | Misrepresent the completion file count as a 100% completion rate for all intake entries | H2T005, H2T008, H2T014, H2T015, H2T018, H2T021, H2T024, H2T066, H2T069, H2T098 |
| H1T026 | Present a conditional group's result as the overall cohort result | H2T011, H2T017, H2T023, H2T044, H2T045, H2T097 |
| H1T027 | Prove an item was peer-reviewed and of high quality despite missing status | H2T009, H2T012, H2T046, H2T057, H2T067, H2T072 |
| H1T028 | Report the total intake and completion counts | H2T014, H2T016, H2T020, H2T055, H2T060, H2T073, H2T076, H2T085 |
| H1T029 | State the end date of observations and absence of later follow-up | H2T004, H2T037, H2T076, H2T079, H2T080, H2T083, H2T084, H2T086, H2T091 |
| H1T030 | Use the total registered records as the denominator for a satisfaction percentage based on a smaller respondent subset | H2T005, H2T013, H2T018, H2T019, H2T021, H2T023, H2T069, H2T098 |

All 30 H1 entries are cited as an adjacency comparison by at least one H2 template. The occupied H1 operations that most constrained construction were H1T017 and H1T019 (temporal persistence and universal scope widening), the denominator family H1T001/H1T018/H1T025/H1T026/H1T030, the causal family H1T005/H1T006/H1T008/H1T009, the conflict family H1T002/H1T003/H1T013/H1T014, and the property-substitution family H1T004/H1T011/H1T015/H1T020/H1T021/H1T022/H1T024/H1T027. No proposed template performs any of those operations; where a proposed template lies near one, its exclusion rule names the forbidden H1 territory and routes such candidates away.

The six H1 entries used by H1's own supported and partial pools (H1T007, H1T010, H1T016, H1T023, H1T028, H1T029) were treated as excluded territory on the same terms as the negative entries, since the frozen rule makes target pool irrelevant to structural equivalence.

## E. Exposure attestation

I did not request, inspect, infer, or reconstruct H1 rater outputs, claim-level ratings, consensus rows, semantic outcome labels, blind-rater bundles, blind ID mappings, or author_intent records.

Additional scope notes for the reviewer:

- no H2 scenario, question, evidence item, evidence passage, claim text, candidate record, author_intent value, QA metadata or checker implementation was authored; the deliverable contains only abstract template definitions;
- illustrative parentheticals inside template definitions name generic measurement categories only and are not authored H2 content;
- no new scoring system, adjudication procedure, threshold or label definition was introduced; the taxonomy adds no semantic rule beyond the frozen stratum and pool definitions;
- the H1 inventory was read only for `template_id`, `transformation` and `claim_ids`; claim IDs were used for coverage and uniqueness verification only.

## F. Status

PROPOSED / INDEPENDENT REVIEW REQUIRED

This taxonomy is not FINAL, not LOCKED and not ACCEPTED. It requires the independent pre-authorship taxonomy review, which must explicitly compare every pair of H2 template definitions and reject semantic duplicates, followed by canonicalization, hashing and merge before any H2 record is authored. No H2 authorship is authorised by this artifact.
