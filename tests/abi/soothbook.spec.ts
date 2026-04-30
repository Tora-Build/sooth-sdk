import { describe, expect, it } from "vitest";
import { encodeFunctionData } from "viem";
import { SoothBookABI } from "../../src/core/abis/SoothBook";

const marketKey = `0x${"00".repeat(32)}` as const;

function functionAbi(name: string) {
  return SoothBookABI.find((item) => item.type === "function" && item.name === name);
}

describe("SoothBook ABI v0.2.1 surface", () => {
  it("removes dead functions", () => {
    expect(functionAbi("resolveMarket")).toBeUndefined();
    expect(functionAbi("markets")).toBeUndefined();
    expect(functionAbi("redeem")).toBeUndefined();
  });

  it("contains v0.2.1 registration and price functions", () => {
    expect(functionAbi("registeredMarkets")).toMatchObject({
      inputs: [{ type: "bytes32" }],
      outputs: [{ type: "bool" }],
    });
    expect(functionAbi("isMarketRegistered")).toMatchObject({
      inputs: [{ type: "address" }],
      outputs: [{ type: "bool" }],
    });
    expect(functionAbi("getImpliedPriceByKey")).toMatchObject({
      inputs: [{ type: "bytes32" }],
      outputs: [{ type: "uint256" }, { type: "uint256" }],
    });
    expect(functionAbi("getImpliedPrice")).toMatchObject({
      inputs: [{ type: "address" }],
      outputs: [{ type: "uint256" }, { type: "uint256" }],
    });
  });

  it("encodes keyed implied-price reads and rejects removed resolve", () => {
    expect(() =>
      encodeFunctionData({
        abi: SoothBookABI,
        functionName: "getImpliedPriceByKey",
        args: [marketKey],
      }),
    ).not.toThrow();

    expect(() =>
      encodeFunctionData({
        abi: SoothBookABI,
        functionName: "resolveMarket",
        args: [marketKey, 1],
      } as never),
    ).toThrow();
  });
});
