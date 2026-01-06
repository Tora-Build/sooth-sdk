import { Address } from 'viem';

export const ADJUDICATOR_REGISTRY = [
    {
        id: 'brevis-opt',
        name: 'Brevis ZK-Optimistic',
        address: '0x1111111111111111111111111111111111111111' as Address,
        desc: 'Optimistic verification with ZK proofs (Recommended).',
        badge: 'Partner'
    },
    {
        id: 'brevis-price',
        name: 'Brevis Price Oracle',
        address: '0x2222222222222222222222222222222222222222' as Address,
        desc: 'Automated resolution via decentralized price feeds.',
        badge: 'Beta'
    }
];

export const GUARDIAN_REGISTRY = [
    {
        id: 'me',
        name: 'Me (Creator)',
        address: 'SELF', // Special key resolved in UI
        desc: 'You retain full control over emergency vetoes.',
        badge: 'Default'
    },
    {
        id: 'dao',
        name: 'Sooth DAO',
        address: '0x3333333333333333333333333333333333333333' as Address,
        desc: 'Managed by the protocol community governance.',
        badge: 'Trustless'
    }
];
