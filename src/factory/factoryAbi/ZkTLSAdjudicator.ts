import { parseAbi } from 'viem';
import { ManualAdjudicatorAbi } from './ManualAdjudicator.js';

/**
 * Curated external zkTLS interface, independently admitted from node releases.
 * Source: sooth-factory 20b16862f12398d48f1b50d75970da0ae3730fab:
 * src/adjudicators/{ZkTLSAdjudicator,AdjudicatorBase}.sol and primus/IPrimusZKTLS.sol.
 * Shared lifecycle selectors come from the independently pinned a128cb6 bundle.
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
