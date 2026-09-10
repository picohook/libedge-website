# P0.5 Harm Diagnostic — Final Independent Review

Status: `HISTORICAL`

## Scope

Independent post-lock verification of the seen A1/A2/A5/A6/A7 harm-regression diagnostic after both primary blind-rater label sets were FINAL / LOCKED and the frozen mapping was legitimately opened.

## Materials verified

The reviewer independently verified the two 150-label FINAL/LOCKED rater outputs, the frozen private mapping and seed commitment, the diagnostic reconstruction, the already accepted harm retrieval coverage record, and the canonical staging record `docs/experiments/p05-harm-regression-evaluation.md`.

## Verification result

Classification: **ACCEPTED — unconditional**.

The reviewer reported zero discrepancies across:

- 150/150 valid R/M/N labels per rater and exact result-ID sets;
- rater-output SHA-256 values recorded by the diagnostic;
- independence of the two rater outputs (13/150 item labels differed, confirming the files were not accidental duplicates);
- revealed seed SHA-256 against the frozen commitment;
- unchanged frozen mapping artifact identity and mapping content;
- reconstruction of anonymous A/B/C labels back to L/S/H;
- arm-level R/M/N totals, Relevant@10 and (R+M)@10 values;
- all per-case H-L, H-S and S-L deltas for both raters;
- explicit retention of unfavorable evidence;
- mechanical coverage accounting: H-v-L 0/5 regressions, H-v-S 0/5, S-v-L 5/5 with the frozen L=100 / S<=50 depth-asymmetry caveat;
- diagnostic-only interpretation boundary, with no synthetic consensus, third-rater trigger, or harm-slice adoption gate.

The reviewer freshly inspected canonical staging contents rather than merely confirming commit existence.

## Reviewer conclusion

The seen harm slice is directionally consistent with the independently accepted fresh-gate result: on aggregate both harm raters report `S > H > L`, while unfavorable per-case results remain visible. The reviewer explicitly confirmed that this diagnostic does not itself adopt S into production.

This acceptance authorizes final P0.5 experiment closure. Production architecture remains a separate decision under D-016.

Last updated: 2026-09-10
