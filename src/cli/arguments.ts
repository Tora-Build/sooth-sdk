import { parseArgs } from 'node:util';
import { factoryAddress, factoryHash } from '../factory/factoryClient.js';
import type { FactoryTransactionAction } from '../factory/factoryTransactions.js';
export { parseFactoryRelease as parseRelease } from '../factory/schema.js';

export const HELP = `soothcli — Factory protocol client (JSON output; read-only by default)

Commands:
  actions                  Print every supported action and its JSON field types
  nodes                    Discover nodes through the v2 catalog
  markets                  Discover markets for an exact node
  identity                 Verify release and node wiring on chain
  read                     Read market, positions and book inventory
  quote                    Read an AMM quote (--outcome 0|1 --shares signed-WAD)
  prepare                  Build a supported action from --input JSON
  action                   Build/simulate an action; --send explicitly broadcasts
  create                   Build createMarket from --input FactoryCreationParams JSON
  trade                    Build trade from --input JSON (outcome, deltaShares, boundWad)
  book                     Build placeOrder from --input OrderParams JSON
  cancel                   Build cancelOrder from --input JSON (orderId)
  settle                   Build settlePosition for --venue
  claim                    Build a supported claim action from --input JSON

Identity: --chain ID --factory ADDRESS --node BYTES32 --release FILE
RPC:      --rpc URL [--rpc URL ...] (independent quorum endpoints)
Market:   --market ADDRESS --venue amm|book
Account:  --account ADDRESS (required for preparation and account reads)
Input:    --input FILE or --input - (stdin); all bigint amounts are decimal strings
Adjudicator: --adjudicator FILE (explicit pinned binding for local/custom deployments)
Catalog:  --catalog URL [--max-pages 100]
Signing:  --send --wallet-env ENV_NAME (private key read only from selected environment)
          [--zero-first] for explicit approve actions only
Receipts: action --receipt HASH --input saved-submission.json checks the submitted
          JSON record against the mined transaction without preparing it again.
          --timeout-ms 120000 bounds send receipt waiting (timeout remains pending).

No key is loaded without --send. Preparation never broadcasts. Approvals are separate
explicit actions; prepare the spending action again after approval. Bounds use the
SDK's WAD/native units: trade boundWad is WAD; order maxTokenIn/minTokenOut are native.
Creation selects --venue amm and has no --market until its mined event supplies one.
Generic actions use {"kind":"...", ...} and the SDK's supported action fields.
`;

const commands = [
  'actions',
  'nodes',
  'markets',
  'identity',
  'read',
  'quote',
  'prepare',
  'action',
  'create',
  'trade',
  'book',
  'cancel',
  'settle',
  'claim',
];
export interface CliFlags {
  help?: boolean;
  chain?: string;
  factory?: string;
  node?: string;
  release?: string;
  rpc?: string[];
  market?: string;
  venue?: string;
  account?: string;
  catalog?: string;
  'max-pages'?: string;
  input?: string;
  outcome?: string;
  shares?: string;
  send?: boolean;
  'wallet-env'?: string;
  'zero-first'?: boolean;
  receipt?: string;
  'timeout-ms'?: string;
  adjudicator?: string;
}
export interface CliArguments {
  command: string;
  flags: CliFlags;
}
export function parseCliArgs(args: string[]): CliArguments {
  const parsed = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      chain: { type: 'string' },
      factory: { type: 'string' },
      node: { type: 'string' },
      release: { type: 'string' },
      rpc: { type: 'string', multiple: true },
      market: { type: 'string' },
      venue: { type: 'string' },
      account: { type: 'string' },
      catalog: { type: 'string' },
      'max-pages': { type: 'string' },
      input: { type: 'string' },
      outcome: { type: 'string' },
      shares: { type: 'string' },
      send: { type: 'boolean' },
      'wallet-env': { type: 'string' },
      'zero-first': { type: 'boolean' },
      receipt: { type: 'string' },
      'timeout-ms': { type: 'string' },
      adjudicator: { type: 'string' },
    },
  });
  if (parsed.values.help) return { command: 'help', flags: parsed.values };
  if (parsed.positionals.length !== 1 || !commands.includes(parsed.positionals[0]!))
    throw new Error('Select one Factory command; use --help');
  const command = parsed.positionals[0]!;
  if (
    parsed.values.send &&
    ['actions', 'nodes', 'markets', 'identity', 'read', 'quote', 'prepare'].includes(command)
  )
    throw new Error(`${command} is read-only; use action --send to submit`);
  if (!parsed.values.send && (parsed.values['wallet-env'] || parsed.values['zero-first']))
    throw new Error('Wallet and zero-first options require --send');
  if (parsed.values.receipt && parsed.values.send)
    throw new Error('Receipt recovery and --send are separate operations');
  if (parsed.values.receipt && command !== 'action')
    throw new Error('Use action --receipt HASH --input saved-submission.json for recovery');
  return { command, flags: parsed.values };
}
export function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`--${name} is required`);
  return value;
}
export function safeInteger(value: string, name: string, min = 1): number {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min) throw new Error(`Invalid ${name}`);
  return result;
}
export function integerAmount(value: unknown, name: string, signed = false): bigint {
  if (typeof value !== 'string' || !(signed ? /^-?\d+$/ : /^\d+$/).test(value))
    throw new Error(`${name} must be a decimal integer string`);
  const result = BigInt(value);
  const limit = signed ? 2n ** 255n : 2n ** 256n;
  if (result <= -limit || result >= limit - 1n)
    throw new Error(`${name} must be finite and bounded (unlimited sentinels are refused)`);
  return result;
}
export function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${name} must be a JSON object`);
  return value as Record<string, unknown>;
}

interface Shape {
  [key: string]:
    | 'uint'
    | 'int'
    | 'number'
    | 'boolean'
    | 'address'
    | 'hash'
    | 'hex'
    | 'text'
    | 'venue'
    | Shape;
}
const order: Shape = {
  outcome: 'number',
  action: 'number',
  priceTick: 'number',
  amount: 'uint',
  matchLimit: 'number',
  validUntil: 'uint',
  expiry: 'uint',
  rest: 'boolean',
  postOnly: 'boolean',
  maxTokenIn: 'uint',
  minTokenOut: 'uint',
};
export const actionShapes: Record<string, Shape> = {
  approve: { venue: 'venue', amountNative: 'uint' },
  approveCreation: { tokenA: 'address', amountNative: 'uint' },
  proposeNodeAdmin: { next: 'address' },
  proposeProtocolAuthority: { next: 'address' },
  acceptNodeAdmin: {},
  cancelNodeAdminTransfer: {},
  acceptProtocolAuthority: {},
  cancelProtocolAuthorityTransfer: {},
  advanceHead: { side: 'number', tick: 'number', maxSteps: 'uint' },
  trade: { outcome: 'number', deltaShares: 'int', boundWad: 'uint' },
  placeOrder: { order },
  cancelOrder: { orderId: 'uint' },
  split: { amountWad: 'uint', maxTokenIn: 'uint', validUntil: 'uint' },
  merge: { amountWad: 'uint', minTokenOut: 'uint', validUntil: 'uint' },
  settlePosition: { venue: 'venue' },
  increaseLiquidity: {
    additionalB: 'uint',
    limits: {
      maxTokenIn: 'uint',
      minLpOut: 'uint',
      minYesPrice: 'uint',
      maxYesPrice: 'uint',
      deadline: 'uint',
      expectedStateHash: 'hash',
    },
  },
  claimAvailable: { positionId: 'uint', units: 'uint' },
  redeemLPPosition: { positionId: 'uint', units: 'uint' },
  claimLPDividendForPosition: { positionId: 'uint' },
  transferLP: { positionId: 'uint', receiver: 'address', units: 'uint' },
  acceptMandate: {
    adjudicator: 'address',
    creator: 'address',
    sqfHash: 'hash',
    deadline: 'uint',
    jobId: 'hash',
    reportHash: 'hash',
  },
  recordJudgment: { outcome: 'number', jobId: 'hash', reportHash: 'hash' },
  resolve: { outcome: 'number', dataHash: 'hash' },
  attest: { proof: 'hex' },
  veto: {},
  settle: {},
  invalidate: {},
  publishAmmConfig: {
    config: {
      feeBps: 'number',
      capitalBps: 'number',
      lpBps: 'number',
      resolutionBps: 'number',
      operatorBps: 'number',
      operatorRecipient: 'address',
    },
  },
  publishBookConfig: {
    config: {
      feeBps: 'number',
      resolutionBps: 'number',
      protocolBps: 'number',
      protocolRecipient: 'address',
    },
  },
  setCreationPaused: { paused: 'boolean' },
  setPermissionlessCreation: { allowed: 'boolean' },
  setCreatorAllowed: { creator: 'address', allowed: 'boolean' },
  setTokenAllowed: { token: 'address', allowed: 'boolean' },
  setAdjudicatorAllowed: { adjudicator: 'address', allowed: 'boolean' },
  setInvalidationBuffer: { buffer: 'uint' },
  claimOperatorFees: {},
  claimProtocolFees: {},
  claimResolutionFees: { venue: 'venue' },
  claimFloor: {},
  claimLPDividend: {},
  claimTimeoutRefund: {},
  claimDeferred: {},
  createMarket: {
    params: {
      question: 'text',
      startTime: 'uint',
      deadline: 'uint',
      adjudicator: 'address',
      tokenA: 'address',
      bBase: 'uint',
      initialProbabilityWad: 'uint',
      adjudicatorConfig: 'hex',
      maxInputNative: 'uint',
      quoteDeadline: 'uint',
      expectedAmmVersion: 'number',
      expectedBookVersion: 'number',
      expectedAmmHash: 'hash',
      expectedBookHash: 'hash',
      resolutionTermsHash: 'hash',
      expectedProfileHash: 'hash',
      expectedInvalidationBuffer: 'uint',
    },
  },
};
function convert(value: unknown, shape: Shape, path: string): Record<string, unknown> {
  const raw = object(value, path);
  for (const key of Object.keys(raw))
    if (!Object.hasOwn(shape, key)) throw new Error(`Unknown ${path}.${key}`);
  const result: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(shape)) {
    const name = `${path}.${key}`,
      item = raw[key];
    if (typeof type === 'object') result[key] = convert(item, type, name);
    else if (type === 'uint' || type === 'int') {
      const amount = integerAmount(item, name, type === 'int');
      if (
        ['validUntil', 'expiry', 'deadline', 'quoteDeadline', 'startTime'].includes(key) &&
        amount >= (1n << 64n) - 1n
      )
        throw new Error(`${name} must be a finite uint64 timestamp`);
      result[key] = amount;
    } else if (type === 'address') result[key] = factoryAddress(item);
    else if (type === 'hash') result[key] = factoryHash(item);
    else {
      const valid =
        type === 'number'
          ? typeof item === 'number' && Number.isSafeInteger(item) && item >= 0
          : type === 'boolean'
            ? typeof item === 'boolean'
            : type === 'venue'
              ? item === 'amm' || item === 'book'
              : type === 'hex'
                ? typeof item === 'string' && /^0x(?:[\da-f]{2})*$/i.test(item)
                : typeof item === 'string' && item.length > 0;
      if (!valid) throw new Error(`Invalid ${name} (${type} required)`);
      result[key] = item;
    }
  }
  return result;
}
export function parseAction(value: unknown, venue: 'amm' | 'book'): FactoryTransactionAction {
  const { kind, ...fields } = object(value, 'action');
  if (typeof kind !== 'string' || !Object.hasOwn(actionShapes, kind))
    throw new Error('Unsupported Factory action kind');
  const result = { kind, ...convert(fields, actionShapes[kind]!, 'action') };
  const selected = result as Record<string, unknown>;
  if (selected.venue && selected.venue !== venue)
    throw new Error('Action venue differs from --venue');
  const book = [
    'placeOrder',
    'cancelOrder',
    'split',
    'merge',
    'advanceHead',
    'claimTimeoutRefund',
    'claimDeferred',
    'claimProtocolFees',
    'publishBookConfig',
  ];
  const amm = [
    'trade',
    'increaseLiquidity',
    'claimAvailable',
    'redeemLPPosition',
    'claimLPDividendForPosition',
    'transferLP',
    'claimFloor',
    'claimLPDividend',
    'claimOperatorFees',
    'publishAmmConfig',
    'createMarket',
    'approveCreation',
  ];
  if ((book.includes(kind) && venue !== 'book') || (amm.includes(kind) && venue !== 'amm'))
    throw new Error('Action requires its exact venue');
  if (
    kind === 'trade' &&
    (selected.deltaShares === 0n || ![0, 1].includes(selected.outcome as number))
  )
    throw new Error('Trade needs nonzero shares and outcome 0 or 1');
  if (kind === 'recordJudgment' && ![0, 1, 2].includes(selected.outcome as number))
    throw new Error('Swarm judgment outcome must be 0, 1 or 2');
  if (
    kind === 'acceptMandate' &&
    ((selected.deadline as bigint) <= 0n || (selected.deadline as bigint) >= (1n << 64n) - 1n)
  )
    throw new Error('Swarm deadline must be finite uint64');
  if (kind === 'placeOrder') {
    const input = selected.order as Record<string, unknown>;
    if (
      ![0, 1].includes(input.outcome as number) ||
      ![0, 1].includes(input.action as number) ||
      (input.amount as bigint) <= 0n ||
      (input.priceTick as number) < 1 ||
      (input.priceTick as number) > 999 ||
      (input.matchLimit as number) <= 0 ||
      (input.validUntil as bigint) <= 0n ||
      (input.rest && (input.expiry as bigint) <= 0n)
    )
      throw new Error('Invalid bounded book order');
  }
  return result as FactoryTransactionAction;
}

export function commandAction(
  command: string,
  value: unknown,
  venue: 'amm' | 'book',
): FactoryTransactionAction {
  const input =
    command === 'settle'
      ? { kind: 'settlePosition', venue }
      : command === 'create'
        ? { kind: 'createMarket', params: value }
        : command === 'book'
          ? { kind: 'placeOrder', order: value }
          : command === 'trade' || command === 'cancel'
            ? { ...object(value, 'input'), kind: command === 'trade' ? 'trade' : 'cancelOrder' }
            : value;
  const action = parseAction(input, venue);
  if (command === 'claim' && !action.kind.startsWith('claim') && action.kind !== 'redeemLPPosition')
    throw new Error('claim requires a supported claim action');
  return action;
}
