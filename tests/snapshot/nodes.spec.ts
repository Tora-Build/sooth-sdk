import snapshot from "../../data/nodes.snapshot.json";
import { describe, expect, it } from "vitest";

describe("embedded nodes snapshot", () => {
  it("contains only v0.2.1 target nodes", () => {
    expect(snapshot.version).toBe("0.2.2");
    expect(snapshot.nodes.map((node) => node.id).sort()).toEqual(["0d896a4f", "3b02bcfd"]);
    expect(snapshot.nodes.every((node) => node.coreVersion === "0.2.1")).toBe(true);
    expect(Object.keys(snapshot.chains).sort()).toEqual(["11155111", "6343"]);
  });
});
