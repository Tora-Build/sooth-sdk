import { describe, expect, it } from "vitest";
import {
  ContractFunctionExecutionError,
  TransactionExecutionError,
  UserRejectedRequestError,
} from "viem";
import { isNonceAlreadyUsed, isWalletRejection } from "../../src/factory/factoryTrade/walletErrors.js";

describe("a send the person refused in the wallet", () => {
  it("is known from the wallet's own error", () => {
    expect(isWalletRejection({ code: 4001, message: "User denied" })).toBe(
      true,
    );
    expect(
      isWalletRejection(new UserRejectedRequestError(new Error("denied"))),
    ).toBe(true);
  });

  // What MetaMask's Cancel gave on 12 Oct 2026: the rejection inside the
  // library's own error for the failed send.
  it("is known through the errors that wrap it", () => {
    const rejected = new UserRejectedRequestError(new Error("denied"));
    const wrapped = new TransactionExecutionError(rejected, {
      account: undefined,
      chain: undefined,
    } as never);
    expect(isWalletRejection(wrapped)).toBe(true);
    expect(
      isWalletRejection(
        new ContractFunctionExecutionError(wrapped, {
          abi: [],
          functionName: "createMarket",
        } as never),
      ),
    ).toBe(true);
  });

  it("is not any other failure", () => {
    expect(isWalletRejection(new Error("execution reverted"))).toBe(false);
    expect(isWalletRejection({ code: -32603 })).toBe(false);
    expect(isWalletRejection({ code: "4001" })).toBe(false);
    expect(isWalletRejection(null)).toBe(false);
    expect(isWalletRejection("User rejected the request.")).toBe(false);
    // A cause chain that loops ends.
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isWalletRejection(loop)).toBe(false);
  });
});

describe("a send the node refused because the wallet reused a number", () => {
  // The text MetaMask's send gave on 12 Oct 2026, inside the library's error
  // for a reverted call of our contract.
  const seen =
    'The contract function "tradePositions" reverted with the following reason:\nRPC 0xaa36a7 Infura eth_sendRawTransaction: nonce too low: next nonce 33, tx nonce 32';

  it("is known from the node's words, through the errors that wrap them", () => {
    expect(isNonceAlreadyUsed(new Error(seen))).toBe(true);
    expect(
      isNonceAlreadyUsed({
        message: "reverted",
        cause: { details: "nonce too low: next nonce 33, tx nonce 32" },
      }),
    ).toBe(true);
    expect(isNonceAlreadyUsed({ shortMessage: "Nonce is too low" })).toBe(true);
    expect(isNonceAlreadyUsed({ name: "NonceTooLowError" })).toBe(true);
    expect(
      isNonceAlreadyUsed(
        new ContractFunctionExecutionError(
          new Error(seen) as never,
          {
            abi: [],
            functionName: "tradePositions",
          } as never,
        ),
      ),
    ).toBe(true);
  });

  it("is not a cancel, a revert or a number that is too high", () => {
    expect(
      isNonceAlreadyUsed(new UserRejectedRequestError(new Error("denied"))),
    ).toBe(false);
    expect(isNonceAlreadyUsed(new Error("execution reverted"))).toBe(false);
    expect(isNonceAlreadyUsed(new Error("nonce too high"))).toBe(false);
    expect(isNonceAlreadyUsed(null)).toBe(false);
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isNonceAlreadyUsed(loop)).toBe(false);
  });
});
