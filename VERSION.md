# LibEdge Version and Release Governance

Status: `ADOPTED / IMPLEMENTATION REVIEW REQUIRED`

Date: 2026-09-28

## Purpose

Define one explicit product-version and release-governance boundary for LibEdge without treating package metadata, deployment state, or an arbitrary semantic-version number as an adopted product release.

## Current baseline

The first LibEdge product baseline is explicitly adopted as `0.9.0` by the human gatekeeper on 2026-09-28. The machine-readable canonical value is stored in `VERSION`.

This baseline records current product identity; it does not authorize production deployment or declare production/go-live readiness.

The repository currently declares `"version": "1.0.0"` in `package.json`. Until a product release baseline is explicitly adopted, that value is package metadata only and MUST NOT be represented as the LibEdge product release.

No repository-native `VERSION.md`, `CHANGELOG.md`, or equivalent product release ledger existed before this proposal.

## Version source of truth

After a baseline version is explicitly adopted:

1. `VERSION` will be the machine-readable canonical product-version source and contain exactly one SemVer value.
2. `VERSION.md` will define the policy and point to the current canonical value; it will not duplicate an independently editable version number.
3. `CHANGELOG.md` will record human-readable release history.
4. User-facing version labels, when introduced, MUST derive from the canonical `VERSION` value or be protected by an automated drift check.
5. `package.json` is not the product-version source of truth unless a future reviewed decision explicitly changes this rule.

## Version scheme

Use Semantic Versioning syntax (`MAJOR.MINOR.PATCH`) for adopted product releases.

Pre-release identifiers such as `-alpha`, `-beta`, or `-rc.N` may be used when a release is explicitly designated pre-release.

The current baseline `0.9.0` was explicitly adopted by the human gatekeeper on 2026-09-28. Future version changes remain subject to the release change-control rule below.

## Release boundary

A deployment and a product release are different events.

- A staging deployment does not create a release.
- A production deployment does not silently create or increment a release.
- A merged PR does not silently create a release.
- A release version changes only through a dedicated reviewed release change.

## Minimum release evidence

Before an adopted product release:

- intended version and release scope are explicit;
- required CI/tests for that scope pass;
- privacy/security and architecture gates applicable to the release remain satisfied;
- material canonical documentation is synchronized;
- staging evidence required for the release exists;
- independent review has accepted the exact release head when required by governance;
- the human gatekeeper has explicitly authorized the release.

Production activation remains a separate authorization when the release includes production-impacting behavior.

## Changelog policy

`CHANGELOG.md` uses release headings with date and version. Entries should be concise and grouped where applicable under:

- Added
- Changed
- Fixed
- Security
- Governance

Historical work before the first adopted product baseline is not retroactively assigned fabricated versions.

## Website version display

The adopted product version may be displayed in the website footer.

The current site contains multiple independently authored footer variants and some pages without a site footer. A later implementation PR should either inject the canonical version through a shared mechanism or add an automated consistency test before duplicating a literal version across static HTML pages.


## Change control

Changing the canonical product version, versioning policy, or release criteria is a material governance change. It requires a dedicated PR and independent review. Release/adoption authority remains human.

## Non-goals

This record does not:

- declare LibEdge `v1.0.0` or production-ready;
- authorize production deployment;
- change semantic-primary or Track A/Track B state;
- alter D-022/D-023;
- reinterpret existing `package.json` metadata as historical product releases.
