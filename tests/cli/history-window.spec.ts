import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandContext } from '../../src/cli/commands/types';
import { history } from '../../src/cli/commands/soothbook';

const OWNER = '0x273612620cd4c725576985e7306d8eE832bf8d4e' as const;
const MARKET_KEY = `0x${'11'.repeat(32)}` as const;

function context(getLogs: ReturnType<typeof vi.fn>): CommandContext {
  const publicClient = {
    getBlockNumber: vi.fn().mockResolvedValue(1_000_000n),
    getLogs,
  };

  return {
    actorManager: {
      currentActor: () => ({
        name: 'alice',
        account: { address: OWNER },
      }),
      getPublicClient: () => publicClient,
    } as unknown as CommandContext['actorManager'],
    deployment: {
      chainId: 6343,
      chainName: 'MegaETH Testnet',
      coreVersion: '0.2.1',
      startBlock: 800_000,
      contracts: {
        SoothBook: '0x20c0a274aB8D90452859809B3804Ef2cFA595132',
        BaseToken: '0x881C78A52a813b9b711514E9f0518D2faCB01F84',
        OrderEngine: '0x14941AA509e484e14A7A7C1cb97fcfcfC96C02A2',
        AMMEngine: '0x1Bab97dBCE105E8715A29B33cd18F0d8B9871383',
        LaunchpadEngine: '0x8B44C61692461496043257f1605E8Af73Dcd952b',
        TruthMarket: '0x6c4f2460e0e6DFb58C6a1a044DC6C1Ccd274C850',
        FeeRouter: '0x7007c321B82F96C16e5Ca114019Fb669633e6219',
        AdjudicatorRegistry: '0x122E97eFeCCC921713D24f5a81351A9457E1c266',
      },
      markets: [],
    },
    config: {
      nodeId: '3b02bcfd',
      chainName: 'MegaETH Testnet',
      coreVersion: '0.2.1',
      chain: { id: 6343, name: 'MegaETH Testnet' } as CommandContext['config']['chain'],
      rpc: 'https://carrot.megaeth.com/rpc',
      deployment: {} as CommandContext['config']['deployment'],
      gasMultiplier: 1.2,
      confirmations: 1,
      postTxWaitMs: 0,
      defaultMarketIndex: 0,
    },
    marketKey: MARKET_KEY,
    marketAddress: null,
    marketName: null,
    recording: { active: false, commands: [], startTime: 0 },
  };
}

describe('CLI history RPC window', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses current v0.2.1 events and labels the bounded result as windowed', async () => {
    const getLogs = vi.fn().mockResolvedValue([]);

    const result = await history(context(getLogs), []);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      source: 'rpc',
      completeness: 'windowed',
      fromBlock: '900000',
      toBlock: '1000000',
      rows: [],
    });

    const eventNames = new Set(getLogs.mock.calls.map(([args]) => args.event.name));
    expect(eventNames).toEqual(new Set(['OrderPlaced', 'OrderFilled', 'OrderCancelled']));
    expect(getLogs).toHaveBeenCalledTimes(48);
    expect(getLogs.mock.calls[0][0]).toMatchObject({
      fromBlock: 900_000n,
      toBlock: 908_999n,
    });
  });
});
