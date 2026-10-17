import { encodeAbiParameters, keccak256, stringToHex, type Hex } from 'viem';

/** This exact implementation is also vendored by standalone IMD request runners. */
export const IMD_SQF_BINDING_ID = keccak256(stringToHex('SOOTH_IMD_SQF_CHUNKS_UTF8_512_V1'));
export const IMD_MAX_QUESTION_BYTES = 15_000;

export type ImdSourceContext = {
  sourceChainId: number;
  fromBlock: number;
  toBlock: number;
};

const QUESTION =
  'Resolve the original Sooth Question Format (SQF) document in definitions using the reconstruction, context, outcomes, and timing instructions. Return one uint256.';
const CONTEXT =
  'chainId and window identify source context only. They do not replace the original SQF sources, observation period, data cutoff, timezone, or resolution conditions.';
const OUTCOMES =
  'Apply the original SQF rules and sources in full. Return 0 for NO, 1 for YES, or 2 only when the original rules explicitly require INVALID. Unless the original rules explicitly prescribe an outcome for that condition, missing evidence, timeout, disagreement, or inability to answer is not an outcome; report inability instead of guessing.';
const RECONSTRUCTION =
  'Reconstruct the complete original SQF by concatenating definitions.sqf_0001, definitions.sqf_0002, and subsequent consecutively numbered sqf_ entries in ascending numeric order, without separators. Preserve every character, whitespace, rule, and metadata field. Apply the complete reconstructed document.';
const TIMING =
  'Preserve the original SQF observation period, data cutoff, timezone, and resolution conditions exactly. Do not answer before its required observation and cutoff have completed. Do not substitute the source block window or request time for the original SQF timing.';

function validateContext(context: ImdSourceContext): void {
  if (
    !Number.isSafeInteger(context.sourceChainId) ||
    context.sourceChainId <= 0 ||
    !Number.isSafeInteger(context.fromBlock) ||
    context.fromBlock < 0 ||
    !Number.isSafeInteger(context.toBlock) ||
    context.toBlock < context.fromBlock
  ) {
    throw new Error(
      'IMD source context requires a positive safe chain ID and ordered nonnegative safe block numbers.',
    );
  }
}

/** Count scalars explicitly: TextEncoder silently replaces lone UTF-16 surrogates. */
function sqfChunks(sqf: string): string[] {
  if (!sqf.length) throw new Error('IMD requires a nonempty original SQF document.');
  const chunks: string[] = [];
  let start = 0;
  let chunkBytes = 0;
  let totalBytes = 0;
  for (let index = 0; index < sqf.length; ) {
    const first = sqf.charCodeAt(index);
    let units = 1;
    let bytes: number;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = sqf.charCodeAt(index + 1);
      if (!(second >= 0xdc00 && second <= 0xdfff))
        throw new Error('IMD SQF contains a lone UTF-16 surrogate.');
      units = 2;
      bytes = 4;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      throw new Error('IMD SQF contains a lone UTF-16 surrogate.');
    } else {
      bytes = first < 0x80 ? 1 : first < 0x800 ? 2 : 3;
    }
    totalBytes += bytes;
    if (totalBytes > IMD_MAX_QUESTION_BYTES)
      throw new Error('IMD envelope exceeds 15000 UTF-8 bytes.');
    if (chunkBytes + bytes > 512) {
      chunks.push(sqf.slice(start, index));
      start = index;
      chunkBytes = 0;
    }
    chunkBytes += bytes;
    index += units;
  }
  chunks.push(sqf.slice(start));
  return chunks;
}

/** Preserve raw SQF exactly; all envelope keys have their canonical lexical order. */
export function buildImdEnvelope(sqf: string, context: ImdSourceContext): string {
  validateContext(context);
  const definitions: Record<string, string> = {
    context: CONTEXT,
    outcomes: OUTCOMES,
    reconstruction: RECONSTRUCTION,
  };
  for (const [index, chunk] of sqfChunks(sqf).entries()) {
    definitions[`sqf_${String(index + 1).padStart(4, '0')}`] = chunk;
  }
  definitions.timing = TIMING;
  const envelope = JSON.stringify({
    answerType: 'uint256',
    chainId: context.sourceChainId,
    definitions,
    evidence: 'panel',
    question: QUESTION,
    v: 1,
    window: { fromBlock: context.fromBlock, toBlock: context.toBlock },
  });
  if (new TextEncoder().encode(envelope).length > IMD_MAX_QUESTION_BYTES) {
    throw new Error('IMD envelope exceeds 15000 UTF-8 bytes.');
  }
  return envelope;
}

export function encodeImdTypeConfig(sqf: string, context: ImdSourceContext): Hex {
  // Encoding must reject every input that cannot produce the onchain commitment.
  buildImdEnvelope(sqf, context);
  return encodeAbiParameters(
    [{ type: 'string' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }],
    [sqf, BigInt(context.sourceChainId), BigInt(context.fromBlock), BigInt(context.toBlock)],
  );
}

export function imdSemanticHash(sqf: string, context: ImdSourceContext): Hex {
  return keccak256(stringToHex(buildImdEnvelope(sqf, context)));
}

/** Read metadata without ever rewriting the committed document. */
function readSqf(sqf: string): {
  question: string;
  rule: Record<string, string>;
  meta: Record<string, string>;
} {
  sqfChunks(sqf);
  const sections = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of sqf.split('\n')) {
    if (line.startsWith('§') && !line.startsWith('§§')) {
      const tag = line.slice(1);
      if (!['question', 'rule', 'event', 'category', 'meta'].includes(tag) || sections.has(tag)) {
        throw new Error('Unsupported or duplicate SQF section.');
      }
      current = [];
      sections.set(tag, current);
    } else {
      if (!current || !line || line.trim() !== line) throw new Error('IMD requires canonical SQF.');
      current.push(line);
    }
  }
  const questionLines = sections.get('question');
  if (!questionLines || questionLines.length !== 1 || !questionLines[0])
    throw new Error('IMD requires a canonical SQF question.');
  if (!sections.has('rule')) throw new Error('IMD requires an SQF rule section.');
  const canonical: string[] = ['§question', questionLines[0]];
  const rule: Record<string, string> = Object.create(null);
  const meta: Record<string, string> = Object.create(null);
  for (const tag of ['rule', 'event', 'category', 'meta']) {
    const lines = sections.get(tag);
    if (!lines) continue;
    if (!lines.length) throw new Error('Empty SQF section.');
    canonical.push(`§${tag}`);
    if (tag === 'event' || tag === 'category') {
      if (lines.length !== 1) throw new Error('Unsupported multiline SQF field.');
      canonical.push(lines[0]!);
      continue;
    }
    let hasFields = false;
    let hasDescription = false;
    for (const line of lines) {
      const colon = line.indexOf(':');
      const field =
        tag === 'meta' ? colon > 0 : !line.startsWith('http') && /^[a-z][a-z0-9-]*:/.test(line);
      if (!field) {
        if (tag === 'meta' || hasFields || hasDescription)
          throw new Error('Unsupported SQF description.');
        hasDescription = true;
      } else {
        const key = line.slice(0, colon);
        const value = line.slice(colon + 1);
        const fields = tag === 'rule' ? rule : meta;
        if (
          key.trim() !== key ||
          value.trim() !== value ||
          key in fields ||
          (tag === 'rule' && key === 'description')
        ) {
          throw new Error('Ambiguous or noncanonical SQF field.');
        }
        fields[key] = value;
        hasFields = true;
      }
      canonical.push(line);
    }
  }
  if (canonical.join('\n') !== sqf) throw new Error('IMD requires canonical SQF section ordering.');
  return { question: questionLines[0], rule, meta };
}

export function readImdSqfQuestion(sqf: string): string {
  return readSqf(sqf).question;
}

function utcMilliseconds(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
    !Number.isSafeInteger(timestamp / 1000) ||
    new Date(timestamp).toISOString().replace('.000Z', 'Z') !== value
  ) {
    throw new Error(`Unsupported SQF ${field}; use an exact UTC timestamp in seconds.`);
  }
  return timestamp;
}

/** Structured timing is a lower bound; the complete original rules still govern resolution. */
export function readImdSqfTiming(sqf: string): {
  dataCutoffMs: number | null;
  resolutionTimeMs: number | null;
} {
  const { rule, meta } = readSqf(sqf);
  const dataCutoffMs =
    rule['data-cutoff'] === undefined ? null : utcMilliseconds(rule['data-cutoff'], 'data-cutoff');
  const resolutionTimeMs =
    meta['observation-time-utc'] === undefined
      ? null
      : utcMilliseconds(meta['observation-time-utc'], 'observation-time-utc');
  const deadlineMs =
    meta['deadline-utc'] === undefined
      ? null
      : utcMilliseconds(meta['deadline-utc'], 'deadline-utc');
  if (
    meta['data-cutoff-utc'] !== undefined &&
    utcMilliseconds(meta['data-cutoff-utc'], 'data-cutoff-utc') !== dataCutoffMs
  ) {
    throw new Error('SQF data cutoff metadata does not match its rule.');
  }
  if (
    meta['deadline-unix'] !== undefined &&
    (!/^(0|[1-9]\d*)$/.test(meta['deadline-unix']) ||
      !Number.isSafeInteger(Number(meta['deadline-unix'])) ||
      deadlineMs === null ||
      Number(meta['deadline-unix']) * 1000 !== deadlineMs)
  ) {
    throw new Error('SQF deadline metadata does not match.');
  }
  const observationType = meta['observation-type'];
  if (
    observationType !== undefined &&
    observationType !== 'point_in_time' &&
    observationType !== 'event_final'
  ) {
    throw new Error('Unsupported SQF observation type.');
  }
  if (
    (observationType === 'point_in_time' && resolutionTimeMs === null) ||
    (observationType === 'event_final' && dataCutoffMs === null) ||
    (rule.observation !== undefined && dataCutoffMs === null && resolutionTimeMs === null)
  ) {
    throw new Error('SQF observation requires supported explicit timing.');
  }
  if (
    dataCutoffMs !== null &&
    ((resolutionTimeMs !== null && dataCutoffMs < resolutionTimeMs) ||
      (deadlineMs !== null && dataCutoffMs < deadlineMs))
  ) {
    throw new Error('SQF data cutoff precedes observation or deadline.');
  }
  return { dataCutoffMs, resolutionTimeMs };
}
