import { parseResearchWork } from './research-work.js';

function defaultPackId() {
  return crypto.randomUUID();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function evidenceSnapshot(work, evidenceId) {
  return {
    evidence_id: evidenceId,
    work_id: work.id,
    title: work.title,
    authors: work.authors.map(({ name, orcid }) => ({ name, orcid })),
    publicationDate: work.publicationDate,
    publicationYear: work.publicationYear,
    doi: work.doi,
    venue: {
      name: work.venue.name,
      publisher: work.venue.publisher
    },
    abstract: work.abstract,
    evidence: {
      level: work.evidence.level,
      sources: work.evidence.sources.map((source) => ({ ...source }))
    },
    urls: { ...work.urls },
    flags: { ...work.flags },
    provenance: work.provenance.map((item) => ({ ...item }))
  };
}

/**
 * Build a pack-local immutable evidence snapshot from ResearchWork[].
 * The pack intentionally carries no raw query, user identity, session, quota,
 * or search-history context.
 */
export function createEvidencePack(works, { packIdFactory = defaultPackId } = {}) {
  if (!Array.isArray(works)) throw new TypeError('EVIDENCE_PACK_WORKS_REQUIRED');
  const packId = String(packIdFactory()).trim();
  if (!packId) throw new Error('EVIDENCE_PACK_ID_INVALID');

  const evidence = works.map((input, index) => {
    const work = parseResearchWork(input);
    const evidenceId = `${packId}:e${index + 1}`;
    return evidenceSnapshot(work, evidenceId);
  });

  return deepFreeze({
    pack_id: packId,
    evidence
  });
}

export function evidenceById(evidencePack) {
  return new Map((evidencePack?.evidence || []).map((item) => [item.evidence_id, item]));
}
