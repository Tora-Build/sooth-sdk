import { Address } from 'viem';
import { Lock, Zap } from 'lucide-react';

export type AdjudicatorType = 'ZK_RULE' | 'ZK_ORACLE' | 'OPTIMISTIC' | 'SELF';
export type TrustModel = 'Trustless' | 'Challengeable' | 'Creator';

export interface AdjudicatorOption {
    id: string;
    name: string;
    address: Address | 'SELF';
    type: AdjudicatorType;
    trustModel: TrustModel;
    trustLevel: number;
    icon: typeof Lock;
    desc: string;
    details: string;
    badge?: string;
}

export interface GuardianOption {
    id: string;
    name: string;
    address: Address | 'SELF';
    desc: string;
    badge?: string;
}

export const ADJUDICATOR_REGISTRY: AdjudicatorOption[] = [
    {
        id: 'brevis-zk-rule',
        name: 'Brevis ZK-Rule',
        address: '0x1111111111111111111111111111111111111111' as Address,
        type: 'ZK_RULE',
        trustModel: 'Trustless',
        trustLevel: 0,
        icon: Lock,
        desc: 'Proves on-chain conditions via ZK proofs. Fully automated.',
        details: 'Uses ZK proofs to verify on-chain data like price feeds or events. No human involvement. Example: "BTC > $100k" via Chainlink price feed.',
        badge: 'Recommended'
    },
    {
        id: 'brevis-zk-oracle',
        name: 'Brevis ZK-Oracle',
        address: '0x2222222222222222222222222222222222222222' as Address,
        type: 'ZK_ORACLE',
        trustModel: 'Trustless',
        trustLevel: 1,
        icon: Lock,
        desc: 'Aggregates data feeds to prove complex conditions.',
        details: 'Computes complex conditions off-chain (like 7-day TWAP), then proves result with ZK. Still trustless - math verifies everything. Example: "ETH TWAP > $3k over 7 days".',
        badge: 'Advanced'
    },
    {
        id: 'brevis-optimistic',
        name: 'Brevis Optimistic',
        address: '0x3333333333333333333333333333333333333333' as Address,
        type: 'OPTIMISTIC',
        trustModel: 'Challengeable',
        trustLevel: 2,
        icon: Zap,
        desc: 'Fast resolution with challenge window. Good for subjective events.',
        details: 'Resolution posted quickly, then 24h challenge period. If disputed, falls back to ZK proof verification. Best for events that need fast resolution but may be contested.',
        badge: 'Beta'
    },

];

export const GUARDIAN_REGISTRY: GuardianOption[] = [
    {
        id: 'dao',
        name: 'Sooth DAO',
        address: '0x5555555555555555555555555555555555555555' as Address,
        desc: 'Managed by the protocol community governance.',
        badge: 'Recommended'
    },
    {
        id: 'none',
        name: 'No Guardian',
        address: '0x0000000000000000000000000000000000000000' as Address,
        desc: 'No veto power. Adjudicator decision is final.',
        badge: 'Risky'
    }
];

export const getTrustColor = (trustModel: TrustModel): string => {
    switch (trustModel) {
        case 'Trustless': return 'text-emerald-400';
        case 'Challengeable': return 'text-yellow-400';
        case 'Creator': return 'text-red-400';
        default: return 'text-white/50';
    }
};

export const getTrustBgColor = (trustModel: TrustModel): string => {
    switch (trustModel) {
        case 'Trustless': return 'bg-emerald-500/10';
        case 'Challengeable': return 'bg-yellow-500/10';
        case 'Creator': return 'bg-red-500/10';
        default: return 'bg-white/5';
    }
};
