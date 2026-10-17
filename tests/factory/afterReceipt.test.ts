import { afterEach, describe, expect, it } from "vitest";
import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
} from "viem";
import { erc20Abi } from "viem";
import {
  forgetReceipt,
  freshReceiptBlock,
  isContractRevert,
  noteReceipt,
  readAtReceipt,
  refreshAt,
} from "../../src/factory/factoryTrade/afterReceipt.js";
import { supportedRelease } from "./fixtures/release.js";

const identity = { chainId: supportedRelease.chainId, factory: supportedRelease.factory, nodeId: `0x${"01".repeat(32)}` as const };

const noWait = async () => {};

function revert(): ContractFunctionExecutionError {
  return new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({
      abi: erc20Abi,
      functionName: "approve",
      message: "execution reverted",
    }),
    {
      abi: erc20Abi,
      functionName: "approve",
      args: ["0x0000000000000000000000000000000000000001", 1n],
    },
  );
}

describe("reads after a receipt", () => {
  afterEach(() => forgetReceipt(identity));

  it("pins to the newest receipt only while it is fresh", () => {
    expect(freshReceiptBlock(identity, 1_000)).toBeUndefined();
    noteReceipt(identity, 10n, 1_000);
    noteReceipt(identity, 9n, 2_000);
    expect(freshReceiptBlock(identity, 30_000)).toBe(10n);
    expect(freshReceiptBlock(identity, 61_001)).toBeUndefined();
  });

  it("reads latest when no receipt is fresh", async () => {
    const seen: (bigint | undefined)[] = [];
    await readAtReceipt(undefined, async (block) => seen.push(block), noWait);
    expect(seen).toEqual([undefined]);
  });

  it("retries while the node does not have the receipt's block yet", async () => {
    let calls = 0;
    const value = await readAtReceipt(
      7n,
      async (block) => {
        calls += 1;
        if (calls < 3) throw new BaseError("header not found");
        return block;
      },
      noWait,
    );
    expect(value).toBe(7n);
    expect(calls).toBe(3);
  });

  it("does not retry a contract's own refusal", async () => {
    let calls = 0;
    await expect(
      readAtReceipt(
        7n,
        async () => {
          calls += 1;
          throw revert();
        },
        noWait,
      ),
    ).rejects.toBeInstanceOf(ContractFunctionExecutionError);
    expect(calls).toBe(1);
  });

  it("gives up after a bounded number of tries", async () => {
    let calls = 0;
    await expect(
      readAtReceipt(
        7n,
        async () => {
          calls += 1;
          throw new BaseError("header not found");
        },
        noWait,
      ),
    ).rejects.toThrow("header not found");
    expect(calls).toBe(8);
  });

  it("refreshes at the head when no receipt is ahead of it", async () => {
    noteReceipt(identity, 10n);
    const asked: (bigint | undefined)[] = [];
    const read = await refreshAt(
      identity,
      async (blockNumber) => {
        asked.push(blockNumber);
        return { number: blockNumber ?? 12n };
      },
      async (block) => block.number,
      noWait,
    );
    expect(read).toBe(12n);
    expect(asked).toEqual([undefined]);
  });

  it("refreshes at the receipt's block when the node's head is behind it", async () => {
    noteReceipt(identity, 10n);
    let missing = 2;
    const read = await refreshAt(
      identity,
      async (blockNumber) => {
        if (blockNumber === undefined) return { number: 9n };
        if (missing > 0) {
          missing -= 1;
          throw new BaseError("block not found");
        }
        return { number: blockNumber };
      },
      async (block) => block.number,
      noWait,
    );
    expect(read).toBe(10n);
  });

  it("tells a revert from a missing block", () => {
    expect(isContractRevert(revert())).toBe(true);
    expect(isContractRevert(new BaseError("header not found"))).toBe(false);
    expect(isContractRevert(new Error("network down"))).toBe(false);
  });
});
