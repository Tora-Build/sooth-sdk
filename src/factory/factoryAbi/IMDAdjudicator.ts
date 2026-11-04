import { parseAbi } from 'viem';

/**
 * Explicit SQF-bound IMD profile interface, independent of the Factory release ABI.
 * Source interface: private sooth-alpha 7d5284df1101e2d05ce41d1648b6166e59a24dab,
 * packages/options-core/src/factoryAbi/IMDAdjudicator.ts, preserved in bundles/imd-sources.json.
 * Source bundle keccak256: 0x57c58cb4fde645f2d0b4120875567f9a237d839aac635fe444e3ed35b00d5aa6.
 * Historical Solidity reference: private sooth-factory-archive 8ab10997ead9f7e0d9afad873aa5799e214f0235,
 * src/adjudicators/{IMDAdjudicator,IMDTestnetAdjudicator,AdjudicatorBase}.sol;
 * those Solidity files at that revision are not preserved in the bundled source snapshots.
 * Bundle integrity does not independently verify private upstream authenticity.
 * This curated interface requires explicit review; regeneration validates its source bundle only.
 * This independent profile pin does not admit that revision's node release.
 * Profile capabilities must be checked with semanticBindingId and adjudicatorType;
 * a matching Factory release alone does not identify this separately admitted profile.
 */
export const IMDAdjudicatorAbi = parseAbi([
  'function semanticBindingId() pure returns (bytes32)',
  'function semanticBindings(address market) view returns (bytes32 questionHash, uint64 sourceChainId, uint64 fromBlock, uint64 toBlock)',
  'function adjudicatorType() pure returns (string)',
  'function attester() view returns (address)',
  'function panelSize() view returns (uint16)',
  'function quorum() view returns (uint16)',
  'function maxValidity() view returns (uint64)',
  'function rejected(address market, bytes32 digest) view returns (bool)',
  'function certificateDigest((bytes32 requestId, uint256 chainId, bytes32 questionHash, uint8 answerType, bytes answer, uint256 figure, uint64 fromBlock, uint64 toBlock, bytes32 blockHash, bytes32 panelJobId, uint16 panelSize, uint16 quorum, uint16 agreed, uint64 issuedAt, uint64 expiresAt) cert) view returns (bytes32)',
  'function marketFactory() view returns (address)',
  'function vetoPeriod() view returns (uint48)',
  'function earlyResolution() view returns (bool)',
  'function profileFrozen() view returns (bool)',
  'function profileHash() view returns (bytes32)',
  'function resolutionRecipient() view returns (address)',
  'function guardians() view returns (address[])',
  'function resolvers() view returns (address[])',
  'function isGuardian(address account) view returns (bool)',
  'function isResolver(address account) view returns (bool)',
  'function owner() view returns (address)',
  'function eip712Domain() view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)',
  'function configureMarket(address market, bytes config)',
  'function resolve(address market, uint8 outcome, bytes32 dataHash)',
  'function attest(address market, bytes proof)',
  'function settle(address market)',
  'function dispute(address market)',
  'function canSettle(address market) view returns (bool)',
  'function getPhase(address market) view returns (uint8)',
  'function getOutcome(address market) view returns (uint8)',
  'function getMarketState(address market) view returns ((uint8 phase, uint8 outcome, uint64 deadline, uint64 vetoEndsAt, address resolver, bytes32 dataHash))',
  'function approveGuardian(address guardian)',
  'function revokeGuardian(address guardian)',
  'function batchUpdateGuardians(address[] toApprove, address[] toRevoke)',
  'function approveResolver(address resolver)',
  'function revokeResolver(address resolver)',
  'function setEarlyResolution(bool allowed)',
  'function setResolutionRecipient(address recipient)',
  'function freezeProfile()',
  'function transferOwnership(address newOwner)',
  'function renounceOwnership()',
  'function PHASE_IDLE() view returns (uint8)',
  'function PHASE_ACTIVE() view returns (uint8)',
  'function PHASE_RESOLVED() view returns (uint8)',
  'function PHASE_ATTESTED() view returns (uint8)',
  'function PHASE_SETTLED() view returns (uint8)',
  'function PHASE_DISPUTED() view returns (uint8)',
  'function OUTCOME_NO() view returns (uint8)',
  'function OUTCOME_YES() view returns (uint8)',
  'function OUTCOME_INVALID() view returns (uint8)',
  'event SemanticBindingConfigured(address indexed market, bytes32 indexed sqfHash, bytes32 indexed questionHash, uint64 sourceChainId, uint64 fromBlock, uint64 toBlock)',
  'event MarketConfigured(address indexed market, address indexed resolver, uint64 deadline)',
  'event OutcomeProposed(address indexed market, uint8 outcome, bytes32 dataHash)',
  'event AttestationVerified(address indexed market, uint256 index)',
  'event MarketSettled(address indexed market, uint8 outcome)',
  'event MarketDisputed(address indexed market, uint8 previousOutcome)',
  'event GuardianApproved(address indexed guardian)',
  'event GuardianRevoked(address indexed guardian)',
  'event ResolverApproved(address indexed resolver)',
  'event ResolverRevoked(address indexed resolver)',
  'event EarlyResolutionConfigured(bool allowed)',
  'event ResolutionRecipientConfigured(address indexed recipient)',
  'event ProfileFrozen(bytes32 indexed profileHash, address indexed resolutionRecipient)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
  'event EIP712DomainChanged()',
  'error InvalidBinding()',
  'error InvalidSourceContext()',
  'error InvalidUTF8()',
  'error InvalidSQF()',
  'error EnvelopeTooLarge()',
]);

/** Testnet profiles report their pinned external certificate signing domain. */
export const IMDTestnetAdjudicatorAbi = [
  ...IMDAdjudicatorAbi,
  ...parseAbi([
    'function certificateChainId() view returns (uint256)',
    'function certificateConsumer() view returns (address)',
    'function certificateMarket(bytes32 digest) view returns (address)',
    'function questionMarket(bytes32 questionHash) view returns (address)',
    'event CertificateAssigned(bytes32 indexed digest, address indexed market)',
  ]),
] as const;
