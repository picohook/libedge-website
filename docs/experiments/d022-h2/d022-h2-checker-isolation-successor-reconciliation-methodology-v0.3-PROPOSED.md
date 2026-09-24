# D-022 H2 Checker-Isolation Successor/Reconciliation Methodology v0.3 — PROPOSED

## 1. Status and Scope
This document proposes a successor/reconciliation methodology for the D-022 checker-isolation governance problem. Its purpose is to determine whether the frozen Grok 4.7 candidate may continue to serve as the basis for H2 evaluation, or whether a fresh checker implementation is required. It defines a prospective rule for future checkers and provides the evidentiary framework for the current candidate without rewriting historical v0.2 failures or retroactively authorizing prohibited access.

Scope: Applies only to the recovered Grok 4.7 candidate and to any future replacement checker. It does not authorize production deployment, provider binding, or H2 semantic acceptance.

## 2. Historical Invariants v0.3 Cannot Rewrite
- v0.2 isolation requirements remain valid; their technical description and intent are preserved as historical record.
- Failure of the v0.2 checker-first mechanism and failure to establish workspace-exclusion remain explicitly documented as findings from the prior evaluation cycle.
- No post-hoc evidence shall be accepted as retroactive proof that technical inability to access existed where no explicit sandbox or filesystem restriction was present.
- Behavioral non-access is not a substitute for an independently attested technical inability to access prohibited artifacts.

## 3. Evidence Classes and Evidentiary Hierarchy
1. **Primary**: Explicit technical restriction logs (e.g., sandbox path deny, repository exclusion whitelist, network firewall rules, attestation signed by an independent reviewer stating inability to access H2/LibEdge).
2. **Secondary**: Behavioral logs showing no attempt to enumerate or access prohibited paths (e.g., `ls`, `Get-ChildItem`, repository clone/pull operations absent from session history).
3. **Tertiary**: Self-reported non-exposure or compliance statements without independent verification.
Evidentiary hierarchy: Primary > Secondary > Tertiary. Tertiary evidence alone is insufficient to satisfy isolation requirements.

## 4. Decision Rule for the Pre-existing Grok 4.7 Candidate
- **Finding**: The candidate is frozen with deterministic test results (15/15 PASS) and was ACCEPT / FINAL / LOCKED by an independent reviewer.
- **Governance Gap**: Neither the checker-first mechanism (Primary evidence absent) nor the workspace-exclusion mechanism (Primary evidence absent) was historically satisfied for this candidate.
- **Disposition**: The existing candidate **may not be authorized for continued use as the basis of H2 evaluation** solely on the basis of the v0.2 governance specification. The historical isolation gate was not satisfied; the ACCEPT / FINAL / LOCKED label from Claude Haiku 4.5 pertains to the codebase integrity but does not override the v0.2 isolation requirements.

## 5. Required Independent Review
For any candidate to proceed under this methodology, an independent reviewer (distinct from the implementer, distinct from the previous reviewer if possible, and authorized under v0.3 governance) must:
- Review the exact candidate bytes (SHA-256: 61870a5ee504a0a4514e75529340401e761134ebd63ca26004b4edb3847a7279, etc.).
- Verify deterministic test results against the latest baseline (15/15 PASS required).
- Produce an attestation statement: "The candidate bytes are identical to the recovered frozen state; no post-hoc modifications have been introduced; no prohibited D-022 artifacts were accessed during generation."
- Sign and timestamp the attestation.

This review is **pre-requisite** for any subsequent H2 authorship-gate submission.

## 6. Fail-Closed Conditions
If the independent review fails to produce the signed attestation, or if the candidate bytes differ from the frozen state, the candidate is **automatically disqualified** and any attempt to evaluate it under H2 semantic rules must be halted. The authorship-gate remains closed until a compliant candidate is produced.

## 7. Prospective Isolation Rule for Any Future/Replacement Checker
Any future/replacement checker must satisfy the following prospective isolation protocol before any H2 prerequisite or evaluation artifact can be made available to the implementer:
- **Pre-commit Freeze**: Checker code, configuration, dependencies, and prompt templates must be hashed and committed to an immutable record before any H2 taxonomy, holdout data, rating schema, or QA/audit material is accessible.
- **Technical Inability**: An independent reviewer must provide a signed attestation confirming that the implementer's environment has been configured such that prohibited D-022 artifacts are **technically inaccessible** (e.g., filesystem permissions, network firewall rules, sandbox restrictions). Behavioral logs showing no attempt to access prohibited content are insufficient without technical proof.
- **Four-Input Limit Enforcement**: The implementer may only receive and read a pre-defined, minimal allowlist of inputs (e.g., task specification, contract, boundary definitions, manifest). Broad enumeration tools (`ls`, `Get-ChildItem`, web fetches to unknown domains, repository traversals) are prohibited and must be blocked or absent from the environment.
- **Chronology**: Freeze commitment must precede any access to H2 material. Timestamped logs must be appended to the freeze manifest.
- **Zero Tolerance**: Any deviation from the isolation protocol results in immediate disqualification of the checker candidate.

## 8. Exact Relationship Between v0.2 and v0.3
v0.3 explicitly acknowledges the v0.2 failures without rewriting them. It introduces a successor rule that **does not retroactively satisfy** the prior isolation mechanisms. The existing candidate is considered non-compliant under the v0.2 spec; its continued use requires an additional independent verification step under the v0.3 rule to determine if it may serve as a transitional artifact, but it does not by itself fulfill the isolation requirement.

## 9. Freeze-Manifest Requirements
Every prospective checker must generate a `FREEZE_INVENTORY.json` (or equivalent) containing:
- Exact SHA-256 hashes of all deliverables (code, test, dependencies, docs).
- Timestamp of freeze creation.
- Signed attestation from independent reviewer confirming isolation.
- List of allowed inputs and explicit confirmation that no prohibited artifacts were accessed.
- Signature and identifier of the independent reviewer.

This manifest must be immutable (e.g., committed to a separate signing repository) and referenced in the evaluation gate.

## 10. H2 Authorship-Gate Consequence
The H2 authorship gate remains closed for any checker candidate until the independent review defined in Section 5 is successfully completed and the freeze-manifest is verified. The Claude Haiku 4.5 ACCEPT / FINAL / LOCKED label is preserved as an integrity check but does not constitute H2 authorship approval under v0.3.

## 11. Role-Separation/Non-Exposure Requirements
- The checker implementer role must be distinct from the H2 evaluator role.
- The independent reviewer must not be the same individual who implemented the checker or who authored the evaluation schema.
- No individual may hold both the "checker implementer" and "H2 semantic evaluator" roles simultaneously for the same candidate.
- All evidence of non-exposure must be logged and auditable; claims of non-access must be substantiated with technical logs or independent attestation.

## 12. Required Machine/Audit Evidence
- Immutable hashes of all deliverables (as in Section 9).
- Session logs (or equivalent) showing environment restrictions in place before code generation (e.g., firewall rules, container isolation reports).
- Timestamped log of allowed input files read before any H2 material was introduced.
- Signed attestation from independent reviewer (human-readable and cryptographic signature if feasible).
- Automated deterministic test results matching the baseline.

## 13. Final Disposition Block

**B. EXISTING CANDIDATE MAY NOT PROCEED; FRESH CHECKER REQUIRED**

Rationale: The historical record shows that the v0.2 isolation requirements were not satisfied for this candidate (neither checker-first nor workspace-exclusion mechanism was established). While the candidate passed deterministic tests and received an independent integrity lock, the fundamental governance failure of isolation remains unaddressed. Permitting its use under v0.2 rules would violate the principle that isolation failures must not be retroactively excused. A fresh checker implementation under the prospective v0.3 isolation protocol is required to ensure methodological integrity and prevent post-hoc convenience from becoming the decision rule.

STATUS: PROPOSED / INDEPENDENT REVIEW REQUIRED