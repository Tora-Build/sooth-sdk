import { describe, expect, it, vi } from "vitest";
import { resolve } from "../../src/cli/commands/soothbook";
import type { CommandContext } from "../../src/cli/commands/types";

describe("sbresolve v0.2.1 stub", () => {
  it("prints a deprecation notice without calling resolveMarket", async () => {
    const writeContract = vi.fn();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const ctx = {
      actorManager: {
        currentWalletClient: () => ({ writeContract }),
      },
      deployment: {
        contracts: { SoothBook: "0x20c0a274aB8D90452859809B3804Ef2cFA595132" },
      },
      config: { confirmations: 1 },
      marketKey: `0x${"11".repeat(32)}`,
    } as unknown as CommandContext;

    const result = await resolve(ctx, ["yes"]);

    expect(result.success).toBe(true);
    expect(writeContract).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join("\n")).toContain("removed SoothBook.resolveMarket");
    log.mockRestore();
  });
});
