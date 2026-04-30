import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../src/cli/commands/soothbook.ts", import.meta.url), "utf8");

describe("Eth Sepolia CLI scan config", () => {
  it("defines scan chunk and start block", () => {
    expect(source).toMatch(/11155111:\s*9_000n/);
    expect(source).toMatch(/11155111:\s*(?!0n)\d[\d_]*n/);
  });
});
