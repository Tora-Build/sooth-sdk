import { parseAbi } from 'viem';
import { ManualAdjudicatorAbi } from './ManualAdjudicator.js';

/**
 * Curated external zkTLS interface, independently admitted from node releases.
 * Historical source: private sooth-factory-archive, recorded as sooth-factory,
 * revision 20b16862f12398d48f1b50d75970da0ae3730fab; bundles/oracle-sources.json
 * preserves src/adjudicators/{ZkTLSAdjudicator,AdjudicatorBase}.sol and primus/IPrimusZKTLS.sol.
 * Source bundle keccak256: 0xdb67c3c4274d31792731196504cbe6483b96a8eb636b0a046fcfdc935d23d1f0.
 * Shared lifecycle selectors use bundles/adjudicator.json at a128cb6aa4a1886f00ffa6b500277fdf128dfd25.
 * Bundle integrity does not independently verify private upstream authenticity.
 * This curated interface requires explicit review; regeneration validates its source bundle only.
 * No constructor is exported: the Manual constructor is not a zkTLS constructor.
 */
export const ZkTLSAdjudicatorAbi = [
  ...ManualAdjudicatorAbi.filter((entry) => entry.type !== 'constructor'),
  ...parseAbi([
    'function primusVerifier() view returns (address)',
    'function timestampDivisor() view returns (uint64)',
    'function sources(address market) view returns (bytes32 specHash, uint64 maxAge)',
    'function specHash((string url,string header,string method,string body) request, (string keyName,string parseType,string parsePath)[] responseResolve, string attConditions) pure returns (bytes32)',
    'error InvalidSource()',
    'error InvalidSpec()',
    'error InvalidData()',
    'error StaleAttestation()',
  ]),
] as const;
