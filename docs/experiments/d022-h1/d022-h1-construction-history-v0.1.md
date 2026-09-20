# D022-H1 Construction History v0.1

This note records pre-freeze construction history without changing any frozen criterion.

## First construction pass — rejected before commit

The first generated draft was structurally complete: 720 records with the required intended distribution.

It failed the already-frozen lexical clone QA. Maximum same-stratum, cross-scenario token-trigram Jaccard similarity was **1.00**, indicating exact normalized template overlap.

No threshold, normalization/tokenization rule, similarity formula, or frozen construction criterion was changed. The failed draft was not committed as a pool artifact, was not sent to raters, and was not run against a candidate checker.

The pool was reconstructed with greater proposition/evidence diversity under the same frozen rules.

## Current candidate

The current candidate passes the frozen structural, domain, exact-duplicate, lexical-clone, and construction-QA checks. Its identity is recorded in `d022-h1-freeze-manifest-v0.1.md`.

This history shows that the preregistered clone guardrail had operative effect; it does not prove semantic independence. Independent reviewer semantic sampling remains required.
