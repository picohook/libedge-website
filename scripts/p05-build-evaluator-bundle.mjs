import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const INPUT_DIR = process.env.P05_RETRIEVAL_DIR || 'input';
const OUT_DIR = process.env.P05_BUNDLE_OUT || 'p05-evaluator-output';
const PUBLIC_DIR = path.join(OUT_DIR, 'public');
const PRIVATE_DIR = path.join(OUT_DIR, 'private');

const FIELD_SET = [
  'title',
  'authors',
  'publicationYear',
  'publicationDate',
  'venue',
  'doi',
  'evidenceLevel',
  'abstract'
];

const RUBRIC = {
  R: 'directly relevant to the stated intent',
  M: 'materially related but incomplete/partial',
  N: 'indirect, topic-adjacent, or irrelevant',
  conjunctiveRule: 'R requires direct coverage of ALL essential explicitly stated components; strong coverage of only one essential component is M.'
};

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function rngFromSeed(seedHex) {
  let counter = 0;
  return () => {
    const h = crypto.createHash('sha256').update(seedHex).update(String(counter++)).digest();
    return h.readUInt32BE(0) / 0x100000000;
  };
}

function shuffle(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function projectWork(item) {
  const work = item?.work || {};
  return {
    title: work.title || null,
    authors: Array.isArray(work.authors)
      ? work.authors.map((author) => author?.name).filter(Boolean)
      : [],
    publicationYear: work.publicationYear ?? null,
    publicationDate: work.publicationDate ?? null,
    venue: work?.venue?.name || null,
    doi: work.doi || null,
    evidenceLevel: work?.evidence?.level || null,
    abstract: work.abstract || null
  };
}

await fs.mkdir(PUBLIC_DIR, { recursive: true });
await fs.mkdir(PRIVATE_DIR, { recursive: true });

const summary = JSON.parse(await fs.readFile(path.join(INPUT_DIR, 'summary.json'), 'utf8'));
if (!Array.isArray(summary.queries) || summary.queries.length !== 40) {
  throw new Error(`Expected 40 retrieval records, found ${summary.queries?.length ?? 'invalid'}`);
}

const seed = crypto.randomBytes(32).toString('hex');
const rng = rngFromSeed(seed);
const originalIds = shuffle(summary.queries.map((q) => q.id), rng);

const mapping = {
  version: 'p05-fresh-evaluator-v1',
  generatedAt: new Date().toISOString(),
  seed,
  queryMap: {},
  armMap: {}
};

const bundle = {
  version: 'p05-fresh-evaluator-v1',
  generatedAt: mapping.generatedAt,
  instructions: {
    task: 'For every result, assign exactly one label: R, M, or N.',
    independence: 'Do not infer or seek retrieval-arm identity. Use only the material in this bundle.',
    mapping: 'A/B/C list labels are anonymous and randomized independently per query.'
  },
  rubric: RUBRIC,
  fieldSet: FIELD_SET,
  queries: []
};

for (let index = 0; index < originalIds.length; index += 1) {
  const originalId = originalIds[index];
  const anonymousQueryId = `Q${String(index + 1).padStart(2, '0')}`;
  const record = JSON.parse(await fs.readFile(path.join(INPUT_DIR, `${originalId}.json`), 'utf8'));

  const arms = shuffle(['L', 'S', 'H'], rng);
  const aliasToArm = { A: arms[0], B: arms[1], C: arms[2] };

  mapping.queryMap[anonymousQueryId] = originalId;
  mapping.armMap[anonymousQueryId] = aliasToArm;

  const lists = {};
  for (const [alias, arm] of Object.entries(aliasToArm)) {
    const top10 = record?.top10?.[arm];
    if (!Array.isArray(top10) || top10.length !== 10) {
      throw new Error(`Expected 10 results for ${originalId}/${arm}`);
    }
    lists[alias] = top10.map((item, resultIndex) => ({
      resultId: `${anonymousQueryId}-${alias}${String(resultIndex + 1).padStart(2, '0')}`,
      rank: resultIndex + 1,
      ...projectWork(item)
    }));
  }

  bundle.queries.push({
    queryId: anonymousQueryId,
    intent: record.intent,
    lists
  });
}

const bundleText = `${JSON.stringify(bundle, null, 2)}\n`;
const canonicalMappingText = `${JSON.stringify(mapping, Object.keys(mapping).sort(), 2)}\n`;
const mappingText = `${JSON.stringify(mapping, null, 2)}\n`;

const manifest = {
  version: bundle.version,
  generatedAt: bundle.generatedAt,
  retrievalWorkflowRun: 34498804224,
  retrievalArtifactId: 10161068719,
  retrievalArtifactSha256: '79241e3b530649d53845c4220c91c8f53dd77e561d9d5ccdd7fe9f5e988e33c8',
  queryCount: bundle.queries.length,
  resultListsPerQuery: 3,
  resultsPerList: 10,
  fieldSet: FIELD_SET,
  bundleSha256: sha256(bundleText),
  mappingSha256: sha256(mappingText),
  seedCommitmentSha256: sha256(seed),
  mappingDisclosure: 'PRIVATE UNTIL BOTH PRIMARY RATERS LOCK ALL LABELS'
};

await fs.writeFile(path.join(PUBLIC_DIR, 'p05-evaluator-bundle.json'), bundleText);
await fs.writeFile(path.join(PUBLIC_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(PRIVATE_DIR, 'p05-evaluator-mapping.json'), mappingText);

console.log(JSON.stringify(manifest, null, 2));
