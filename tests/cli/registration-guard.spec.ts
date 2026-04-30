import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandContext } from "../../src/cli/commands/types";

const readContractWithRpcFallback = vi.fn();

vi.mock("../../src/cli/cli-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/cli/cli-utils")>();
  return {
    ...actual,
    readContractWithRpcFallback,
  };
});

function ctx(): CommandContext {
  return {
    actorManager: {} as CommandContext["actorManager"],
    deployment: {
      chainId: 6343,
      chainName: "MegaETH Testnet",
      coreVersion: "0.2.1",
      contracts: {
        SoothBook: "0x20c0a274aB8D90452859809B3804Ef2cFA595132",
        BaseToken: "0x881C78A52a813b9b711514E9f0518D2faCB01F84",
        OrderEngine: "0x14941AA509e484e14A7A7C1cb97fcfcfC96C02A2",
        AMMEngine: "0x1Bab97dBCE105E8715A29B33cd18F0d8B9871383",
        LaunchpadEngine: "0x8B44C61692461496043257f1605E8Af73Dcd952b",
        TruthMarket: "0x6c4f2460e0e6DFb58C6a1a044DC6C1Ccd274C850",
        FeeRouter: "0x7007c321B82F96C16e5Ca114019Fb669633e6219",
        AdjudicatorRegistry: "0x122E97eFeCCC921713D24f5a81351A9457E1c266",
      },
      markets: [],
    },
    config: {
      nodeId: "3b02bcfd",
      chainName: "MegaETH Testnet",
      coreVersion: "0.2.1",
      chain: { id: 6343, name: "MegaETH Testnet" } as CommandContext["config"]["chain"],
      rpc: "https://rpc.sooth.market/megaeth-testnet",
      deployment: {} as CommandContext["config"]["deployment"],
      gasMultiplier: 1.2,
      confirmations: 1,
      postTxWaitMs: 0,
      defaultMarketIndex: 0,
    },
    marketKey: `0x${"11".repeat(32)}`,
    marketAddress: null,
    marketName: null,
    recording: { active: false, commands: [], startTime: 0 },
  };
}

describe("SoothBook registration guard", () => {
  beforeEach(() => {
    readContractWithRpcFallback.mockReset();
  });

  it("book short-circuits via registeredMarkets", async () => {
    readContractWithRpcFallback.mockResolvedValue(false);
    const { book } = await import("../../src/cli/commands/soothbook");

    const result = await book(ctx(), []);

    expect(readContractWithRpcFallback).toHaveBeenCalledTimes(1);
    expect(readContractWithRpcFallback.mock.calls[0][2]).toMatchObject({
      functionName: "registeredMarkets",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("not registered in SoothBook");
  });

  it("state short-circuits via registeredMarkets", async () => {
    readContractWithRpcFallback.mockResolvedValue(false);
    const { state } = await import("../../src/cli/commands/soothbook");

    const result = await state(ctx(), []);

    expect(readContractWithRpcFallback).toHaveBeenCalledTimes(1);
    expect(readContractWithRpcFallback.mock.calls[0][2]).toMatchObject({
      functionName: "registeredMarkets",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("not registered in SoothBook");
  });

  it("invariants short-circuit via registeredMarkets", async () => {
    readContractWithRpcFallback.mockResolvedValue(false);
    const { runAllInvariants } = await import("../../src/cli/assertions/invariants");

    const result = await runAllInvariants(ctx());

    expect(readContractWithRpcFallback).toHaveBeenCalledTimes(1);
    expect(readContractWithRpcFallback.mock.calls[0][2]).toMatchObject({
      functionName: "registeredMarkets",
    });
    expect(result).toHaveLength(4);
    expect(result.every((item) => item.message.includes("AMM-only"))).toBe(true);
  });
});
