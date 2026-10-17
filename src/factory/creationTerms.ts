import {
  encodeAbiParameters,
  isAddress,
  keccak256,
  parseAbiParameters,
  toBytes,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { encodeImdTypeConfig, readImdSqfQuestion, type ImdSourceContext } from './imdEnvelope.js';

export interface ZkTlsRequest {
  url: string;
  header: string;
  method: string;
  body: string;
}
export interface ZkTlsResponseResolve {
  keyName: string;
  parseType: string;
  parsePath: string;
}
export type ResolutionConfig =
  | { kind: 'manual' }
  | { kind: 'imd'; context: ImdSourceContext }
  | {
      kind: 'zktls';
      request: ZkTlsRequest;
      responseResolve: readonly ZkTlsResponseResolve[];
      attConditions: string;
      maxAge: number;
    };

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()))
    throw new Error(`${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`);
  return value;
}
function json(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
}

export function parseZkTlsSpecification(
  value: string,
  maxAge: number,
): Extract<ResolutionConfig, { kind: 'zktls' }> {
  const spec = object(json(value, 'zkTLS specification'), 'zkTLS specification');
  const request = object(spec.request, 'zkTLS request');
  const parsedRequest: ZkTlsRequest = {
    url: text(request.url, 'Request URL'),
    header: text(request.header, 'Request headers', true),
    method: text(request.method, 'Request method'),
    body: text(request.body, 'Request body', true),
  };
  let url: URL;
  try {
    url = new URL(parsedRequest.url);
  } catch {
    throw new Error('Request URL must be an absolute HTTP or HTTPS URL.');
  }
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('Request URL must use HTTP or HTTPS.');
  if (!/^[A-Z]+$/.test(parsedRequest.method))
    throw new Error('Request method must be an uppercase HTTP method.');
  if (parsedRequest.header !== '')
    object(json(parsedRequest.header, 'Request headers'), 'Request headers');
  if (!Array.isArray(spec.responseResolve) || !spec.responseResolve.length)
    throw new Error('Add at least one response extraction rule.');
  const responseResolve = spec.responseResolve.map((value: unknown) => {
    const rule = object(value, 'Response extraction rule');
    return {
      keyName: text(rule.keyName, 'Response key'),
      parseType: text(rule.parseType, 'Response parse type'),
      parsePath: text(rule.parsePath, 'Response parse path'),
    };
  });
  if (new Set(responseResolve.map((rule) => rule.keyName)).size !== responseResolve.length)
    throw new Error('Response extraction keys must be unique.');
  const attConditions = text(spec.attConditions, 'Attestation conditions', true);
  if (attConditions !== '') {
    const conditions = json(attConditions, 'Attestation conditions');
    if (conditions === null || typeof conditions !== 'object')
      throw new Error('Attestation conditions must be a JSON object or array.');
  }
  if (!Number.isInteger(maxAge) || maxAge < 1 || maxAge > 3600)
    throw new Error('The attestation window must be 1–3600 whole seconds after the deadline.');
  return { kind: 'zktls', request: parsedRequest, responseResolve, attConditions, maxAge };
}

const specParameters = parseAbiParameters(
  '(string url,string header,string method,string body) request,(string keyName,string parseType,string parsePath)[] responseResolve,string attConditions',
);
export function zkTlsSpecHash(spec: Extract<ResolutionConfig, { kind: 'zktls' }>): Hex {
  const valid = parseZkTlsSpecification(JSON.stringify(spec), spec.maxAge);
  return keccak256(
    encodeAbiParameters(specParameters, [
      valid.request,
      valid.responseResolve,
      valid.attConditions,
    ]),
  );
}

export function buildResolutionTerms(
  question: string,
  resolver: Address,
  deadline: bigint,
  resolution: ResolutionConfig,
): { question: string; adjudicatorConfig: Hex; resolutionTermsHash: Hex } {
  if (!isAddress(resolver) || resolver.toLowerCase() === zeroAddress)
    throw new Error('Select a valid, non-zero approved resolver address.');
  if (deadline <= 0n || deadline > (1n << 64n) - 1n)
    throw new Error('Deadline must be a positive uint64 timestamp.');
  let typeConfig: Hex;
  switch (resolution.kind) {
    case 'manual':
      typeConfig = '0x';
      break;
    case 'imd':
      readImdSqfQuestion(question);
      typeConfig = encodeImdTypeConfig(question, resolution.context);
      break;
    case 'zktls':
      typeConfig = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'uint64' }],
        [zkTlsSpecHash(resolution), BigInt(resolution.maxAge)],
      );
      break;
    default:
      throw new Error('Unsupported resolution configuration.');
  }
  if (!question.trim()) throw new Error('Enter a market question.');
  return {
    question,
    adjudicatorConfig: encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint64' }, { type: 'bytes' }],
      [resolver, deadline, typeConfig],
    ),
    resolutionTermsHash: keccak256(toBytes(question)),
  };
}
