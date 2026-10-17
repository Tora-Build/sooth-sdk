import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  sha256,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { parseFactoryAdjudicatorBinding, type FactoryAdjudicatorBinding } from './adjudicators.js';
import { SwarmAdjudicatorAbi } from './factoryAbi/SwarmAdjudicator.js';

/** Transport values only; the report may contain unrestricted research and reasoning. */
export type SwarmOutcome = 0 | 1 | 2;
export interface SwarmMandateInput {
  chainId: bigint;
  adjudicator: Address;
  relay: Address;
  creator: Address;
  sqfHash: Hex;
  deadline: bigint;
  jobId: Hex;
  reportHash: Hex;
}
export interface SwarmJudgmentInput {
  chainId: bigint;
  adjudicator: Address;
  market: Address;
  mandateId: Hex;
  outcome: SwarmOutcome;
  jobId: Hex;
  reportHash: Hex;
}
export interface SwarmCall {
  to: Address;
  data: Hex;
  value: 0n;
}
export interface SwarmAcceptanceRequest {
  binding: FactoryAdjudicatorBinding;
  relay: Address;
  creator: Address;
  /** The full exact question string supplied to MarketFactory. Never normalized. */
  sqf: string;
  deadline: bigint;
  /** Current chain timestamp, in seconds. */
  now: bigint;
  /** Exact backend job UUID text. */
  jobId: string;
  /** Original report bytes, not parsed or reserialized JSON. */
  report: Uint8Array;
}
export interface SwarmAcceptanceResult {
  mandate: SwarmMandateInput;
  mandateId: Hex;
  call: SwarmCall;
}
export interface SwarmCreationConfig {
  question: string;
  questionHash: Hex;
  creator: Address;
  deadline: bigint;
  adjudicator: Address;
  adjudicatorConfig: Hex;
  mandateId: Hex;
}
export interface SwarmJudgmentRequest {
  binding: FactoryAdjudicatorBinding;
  market: Address;
  mandateId: Hex;
  outcome: SwarmOutcome;
  jobId: string;
  report: Uint8Array;
}
export interface SwarmJudgmentResult {
  judgment: SwarmJudgmentInput;
  digest: Hex;
  recordCall: SwarmCall;
  resolveCall: SwarmCall;
}

const mandateParameters = parseAbiParameters(
  'uint256 chainId, address adjudicator, address relay, address creator, bytes32 sqfHash, uint64 deadline, bytes32 jobId, bytes32 reportHash',
);
const judgmentParameters = parseAbiParameters(
  'uint256 chainId, address adjudicator, address market, bytes32 mandateId, uint8 outcome, bytes32 jobId, bytes32 reportHash',
);
const typeConfigParameters = parseAbiParameters('string sqf, bytes32 mandateId');
const marketConfigParameters = parseAbiParameters(
  'address resolver, uint64 deadline, bytes typeConfig',
);
const maxUint64 = (1n << 64n) - 1n;

function address(value: Address): Address {
  if (!/^0x[\da-f]{40}$/i.test(value) || /^0x0{40}$/i.test(value))
    throw new Error('Invalid swarm address');
  return value;
}
function hash(value: Hex): Hex {
  if (!/^0x[\da-f]{64}$/i.test(value) || /^0x0{64}$/i.test(value))
    throw new Error('Invalid swarm hash');
  return value;
}
function finiteDeadline(value: bigint): bigint {
  if (value <= 0n || value >= maxUint64) throw new Error('Swarm deadline must be finite uint64');
  return value;
}
function chainId(value: bigint): bigint {
  if (value <= 0n || value >= 1n << 256n) throw new Error('Invalid swarm chainId');
  return value;
}
function outcome(value: SwarmOutcome): SwarmOutcome {
  if (value !== 0 && value !== 1 && value !== 2) throw new Error('Invalid swarm outcome');
  return value;
}
function swarmBinding(input: FactoryAdjudicatorBinding): FactoryAdjudicatorBinding {
  const binding = parseFactoryAdjudicatorBinding(input);
  if (binding.kind !== 'swarm-expert-sqf') throw new Error('Expected swarm-expert-sqf profile');
  return binding;
}

/** Hash all UTF-8 SQF bytes, including whitespace and section order. */
export function hashSwarmSQF(sqf: string): Hex {
  if (sqf.trim().length === 0) throw new Error('Swarm SQF must not be empty');
  const bytes = toBytes(sqf);
  // TextEncoder replaces lone UTF-16 surrogates. Refuse that lossy conversion.
  if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== sqf)
    throw new Error('Swarm SQF must be lossless UTF-8');
  return keccak256(bytes);
}
export function hashSwarmJobId(jobId: string): Hex {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(jobId))
    throw new Error('Swarm jobId must be a canonical lowercase UUID');
  return sha256(toBytes(jobId));
}
export function hashSwarmReport(report: Uint8Array): Hex {
  return sha256(report);
}

/** Identical to acceptMandate's abi.encode commitment, including the intended creator. */
export function getSwarmMandateId(input: SwarmMandateInput): Hex {
  return keccak256(
    encodeAbiParameters(mandateParameters, [
      chainId(input.chainId),
      address(input.adjudicator),
      address(input.relay),
      address(input.creator),
      hash(input.sqfHash),
      finiteDeadline(input.deadline),
      hash(input.jobId),
      hash(input.reportHash),
    ]),
  );
}
export function getSwarmJudgmentDigest(input: SwarmJudgmentInput): Hex {
  return keccak256(
    encodeAbiParameters(judgmentParameters, [
      chainId(input.chainId),
      address(input.adjudicator),
      address(input.market),
      hash(input.mandateId),
      outcome(input.outcome),
      hash(input.jobId),
      hash(input.reportHash),
    ]),
  );
}
export function encodeSwarmAcceptMandate(input: SwarmMandateInput): Hex {
  return encodeFunctionData({
    abi: SwarmAdjudicatorAbi,
    functionName: 'acceptMandate',
    args: [
      address(input.creator),
      hash(input.sqfHash),
      finiteDeadline(input.deadline),
      hash(input.jobId),
      hash(input.reportHash),
    ],
  });
}
export function encodeSwarmTypeConfig(sqf: string, mandateId: Hex): Hex {
  hashSwarmSQF(sqf);
  return encodeAbiParameters(typeConfigParameters, [sqf, hash(mandateId)]);
}
export function encodeSwarmMarketConfig(input: {
  relay: Address;
  deadline: bigint;
  sqf: string;
  mandateId: Hex;
}): Hex {
  return encodeAbiParameters(marketConfigParameters, [
    address(input.relay),
    finiteDeadline(input.deadline),
    encodeSwarmTypeConfig(input.sqf, input.mandateId),
  ]);
}
export function encodeSwarmRecordJudgment(input: SwarmJudgmentInput): Hex {
  return encodeFunctionData({
    abi: SwarmAdjudicatorAbi,
    functionName: 'recordJudgment',
    args: [
      address(input.market),
      outcome(input.outcome),
      hash(input.jobId),
      hash(input.reportHash),
    ],
  });
}
export function encodeSwarmResolve(input: SwarmJudgmentInput): Hex {
  return encodeFunctionData({
    abi: SwarmAdjudicatorAbi,
    functionName: 'resolve',
    args: [address(input.market), outcome(input.outcome), getSwarmJudgmentDigest(input)],
  });
}

/** Offline encoding only: the caller must verify the network-accepted report and its
 * ACCEPT decision before using this result. These helpers do not authenticate reports.
 * The approved relay must submit this after profile freeze.
 */
export function prepareSwarmAcceptance(input: SwarmAcceptanceRequest): SwarmAcceptanceResult {
  const binding = swarmBinding(input.binding);
  if (input.now < 0n || finiteDeadline(input.deadline) <= input.now)
    throw new Error('Swarm acceptance deadline must be in the future');
  const mandate: SwarmMandateInput = {
    chainId: BigInt(binding.chainId),
    adjudicator: binding.address,
    relay: input.relay,
    creator: input.creator,
    sqfHash: hashSwarmSQF(input.sqf),
    deadline: input.deadline,
    jobId: hashSwarmJobId(input.jobId),
    reportHash: hashSwarmReport(input.report),
  };
  return {
    mandate,
    mandateId: getSwarmMandateId(mandate),
    call: { to: binding.address, data: encodeSwarmAcceptMandate(mandate), value: 0n },
  };
}

/** Register the mandate on chain before submitting creation with this config. */
export function prepareSwarmCreationConfig(
  sqf: string,
  mandate: SwarmMandateInput,
): SwarmCreationConfig {
  const questionHash = hashSwarmSQF(sqf);
  if (questionHash.toLowerCase() !== mandate.sqfHash.toLowerCase())
    throw new Error('Swarm SQF does not match the accepted mandate');
  const mandateId = getSwarmMandateId(mandate);
  return {
    question: sqf,
    questionHash,
    creator: mandate.creator,
    deadline: mandate.deadline,
    adjudicator: mandate.adjudicator,
    mandateId,
    adjudicatorConfig: encodeSwarmMarketConfig({
      relay: mandate.relay,
      deadline: mandate.deadline,
      sqf,
      mandateId,
    }),
  };
}

/** Submit recordCall after the deadline, then resolveCall, using the market's relay.
 * The contract checks the accepted mandate, phase, replay protection and veto history.
 * Report hashes record relay-trusted output; they are not IMD authenticity proofs.
 * The caller must verify network acceptance and that the report's judgment matches
 * the requested outcome. This offline encoder does not authenticate or parse reports.
 */
export function prepareSwarmJudgment(input: SwarmJudgmentRequest): SwarmJudgmentResult {
  const binding = swarmBinding(input.binding);
  const judgment: SwarmJudgmentInput = {
    chainId: BigInt(binding.chainId),
    adjudicator: binding.address,
    market: input.market,
    mandateId: input.mandateId,
    outcome: input.outcome,
    jobId: hashSwarmJobId(input.jobId),
    reportHash: hashSwarmReport(input.report),
  };
  return {
    judgment,
    digest: getSwarmJudgmentDigest(judgment),
    recordCall: { to: binding.address, data: encodeSwarmRecordJudgment(judgment), value: 0n },
    resolveCall: { to: binding.address, data: encodeSwarmResolve(judgment), value: 0n },
  };
}
