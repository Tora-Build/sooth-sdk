import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const soothBook = "0x20c0a274aB8D90452859809B3804Ef2cFA595132";
const zeroKey = `0x${"00".repeat(32)}`;

describe("SoothBook v0.2.1 live surface", () => {
  it.skipIf(!process.env.RPC_URL_MEGAETH)("exposes registeredMarkets on deployed bytecode", () => {
    const out = execFileSync(
      "cast",
      [
        "call",
        soothBook,
        "registeredMarkets(bytes32)(bool)",
        zeroKey,
        "--rpc-url",
        process.env.RPC_URL_MEGAETH!,
      ],
      { encoding: "utf8" },
    );

    expect(out.trim()).toBe("false");
  });

  it.skipIf(!process.env.V021_GRADUATED_MARKET_KEY || !process.env.RPC_URL_MEGAETH)(
    "returns tuple prices by market key for a known graduated market",
    () => {
      const out = execFileSync(
        "cast",
        [
          "call",
          soothBook,
          "getImpliedPriceByKey(bytes32)(uint256,uint256)",
          process.env.V021_GRADUATED_MARKET_KEY!,
          "--rpc-url",
          process.env.RPC_URL_MEGAETH!,
        ],
        { encoding: "utf8" },
      );
      const values = out.trim().split(/\s+/).map((value) => BigInt(value));
      expect(values).toHaveLength(2);
      expect(values[0]).toBeGreaterThan(0n);
      expect(values[1]).toBeGreaterThan(0n);
    },
  );
});
