import { parseResearchWork } from './research-work.js';

export const SUPPORT_CHECK_INPUT_VERSION = 'v1';

function cloneEvidenceSource(source) {
  return {
    kind: source.kind,
    provider: source.provider,
    sourceRef: source.sourceRef,
    retrievedAt: source.retrievedAt
  };
}

function cloneProvenance(item) {
  return {
    provider: item.provider,
    providerId: item.providerId,
    retrievedAt: item.retrievedAt
  };
}

/**
 * Build a retrieval-independent, evidence-preserving input envelope for a
 * downstream support checker.
 *
 * This adapter deliberately performs no support judgment and does not inspect
 * retrieval mode/rank. It only carries validated ResearchWork evidence and
 * provenance forward so a checker can reason over explicit evidence later.
 */
export function buildSupportCheckInput(work) {
  const parsed = parseResearchWork(work);

  return {
    version: SUPPORT_CHECK_INPUT_VERSION,
    workId: parsed.id,
    title: parsed.title,
    abstract: parsed.abstract,
    evidence: {
      level: parsed.evidence.level,
      sources: parsed.evidence.sources.map(cloneEvidenceSource)
    },
    provenance: parsed.provenance.map(cloneProvenance)
  };
}

export function buildSupportCheckInputs(works) {
  if (!Array.isArray(works)) return [];
  return works.map(buildSupportCheckInput);
}
