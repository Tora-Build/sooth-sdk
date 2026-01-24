export const TruthMarketAbi = [
    {
        type: "event",
        name: "MarketCreated",
        inputs: [
            { name: "market", type: "address", indexed: true },
            { name: "question", type: "string", indexed: false },
            { name: "startTime", type: "uint64", indexed: false },
            { name: "deadline", type: "uint64", indexed: false },
        ],
    },
    {
        type: "event",
        name: "MarketSettled",
        inputs: [
            { name: "outcome", type: "uint8", indexed: false },
            { name: "adjudicator", type: "address", indexed: true },
        ],
    },
    // V11 Events
    {
        type: "event",
        name: "MarketVetoed",
        inputs: [
            { name: "market", type: "address", indexed: true },
            { name: "previousOutcome", type: "uint8", indexed: false },
            { name: "previousTStar", type: "uint64", indexed: false },
        ],
    },
    {
        type: "event",
        name: "MarketFinalized",
        inputs: [
            { name: "market", type: "address", indexed: true },
        ],
    },
    {
        type: "function",
        name: "question",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
    },
] as const;
