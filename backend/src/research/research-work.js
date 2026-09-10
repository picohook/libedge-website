import { z } from 'zod';

const nullableString = z.string().nullable();

export const researchWorkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.object({
    name: z.string().min(1),
    orcid: nullableString
  })),
  publicationDate: nullableString,
  publicationYear: z.number().int().nullable(),
  type: nullableString,
  language: nullableString,
  doi: nullableString,
  identifiers: z.record(z.string(), z.string()),
  venue: z.object({
    name: nullableString,
    issn: z.array(z.string()),
    publisher: nullableString
  }),
  abstract: nullableString,
  evidence: z.object({
    level: z.enum(['FULL_TEXT', 'ABSTRACT', 'METADATA_ONLY']),
    sources: z.array(z.object({
      kind: z.enum(['full_text', 'abstract', 'metadata']),
      provider: z.string().min(1),
      sourceRef: nullableString,
      retrievedAt: z.string().min(1)
    }))
  }),
  openAccess: z.object({
    isOa: z.boolean().nullable(),
    status: nullableString,
    url: nullableString,
    source: nullableString
  }),
  licenses: z.array(z.object({
    url: nullableString,
    type: nullableString,
    appliesTo: nullableString,
    source: z.string().min(1)
  })),
  citations: z.object({
    preferredCount: z.number().int().nonnegative().nullable(),
    preferredSource: nullableString,
    observations: z.array(z.object({
      source: z.string().min(1),
      count: z.number().int().nonnegative(),
      checkedAt: z.string().min(1)
    }))
  }),
  urls: z.object({
    doi: nullableString,
    publisher: nullableString,
    openAccess: nullableString
  }),
  flags: z.object({
    retracted: z.boolean().nullable()
  }),
  provenance: z.array(z.object({
    provider: z.string().min(1),
    providerId: nullableString,
    retrievedAt: z.string().min(1)
  }))
}).superRefine((work, ctx) => {
  const mappedDoi = work.identifiers?.doi ?? null;
  if (work.doi !== mappedDoi) {
    ctx.addIssue({
      code: 'custom',
      path: ['identifiers', 'doi'],
      message: 'doi must match identifiers.doi'
    });
  }
});

export function parseResearchWork(input) {
  return researchWorkSchema.parse(input);
}
