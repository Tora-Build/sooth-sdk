import { describe, expect, it, vi } from "vitest";
import { failedAccountSetup, sendConfirmed } from "../../src/factory/factoryTrade/firstUse.js";

const ok = { status: "success", type: "eip1559" } as const;
const upgradeFailed = { status: "reverted", type: "eip7702" } as const;

describe("failedAccountSetup", () => {
  it("is a reverted type-4 receipt and nothing else", () => {
    expect(failedAccountSetup(upgradeFailed)).toBe(true);
    expect(failedAccountSetup({ status: "success", type: "eip7702" })).toBe(
      false,
    );
    expect(failedAccountSetup({ status: "reverted", type: "eip1559" })).toBe(
      false,
    );
  });
});

describe("sendConfirmed", () => {
  it("sends once when the first try succeeds", async () => {
    const send = vi.fn().mockResolvedValue(ok);
    const beforeResend = vi.fn();
    const result = await sendConfirmed({ send, beforeResend });
    expect(result).toEqual({ receipt: ok, resent: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(beforeResend).not.toHaveBeenCalled();
  });

  it("sends the same call once more after a failed account upgrade", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(upgradeFailed)
      .mockResolvedValueOnce(ok);
    const beforeResend = vi.fn();
    const result = await sendConfirmed({ send, beforeResend });
    expect(result).toEqual({ receipt: ok, resent: true });
    expect(send).toHaveBeenCalledTimes(2);
    expect(beforeResend).toHaveBeenCalledWith(upgradeFailed);
  });

  it("does not resend an ordinary revert", async () => {
    const reverted = { status: "reverted", type: "eip1559" } as const;
    const send = vi.fn().mockResolvedValue(reverted);
    const result = await sendConfirmed({ send, beforeResend: vi.fn() });
    expect(result).toEqual({ receipt: reverted, resent: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never sends a third time", async () => {
    const send = vi.fn().mockResolvedValue(upgradeFailed);
    const result = await sendConfirmed({ send, beforeResend: vi.fn() });
    expect(result).toEqual({ receipt: upgradeFailed, resent: true });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("does not resend when the check before the second send fails", async () => {
    const send = vi.fn().mockResolvedValue(upgradeFailed);
    const beforeResend = vi.fn().mockRejectedValue(new Error("price moved"));
    await expect(sendConfirmed({ send, beforeResend })).rejects.toThrow(
      "price moved",
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
