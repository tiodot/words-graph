import { describe, it, expect } from "vitest";
import { findRootMatches, findAffixMatches } from "@/lib/root-affix";

describe("findRootMatches", () => {
  it("should find words sharing the same root", () => {
    const result = findRootMatches("action");
    expect(result).toContain("react");
    expect(result).toContain("active");
    expect(result).toContain("interact");
  });

  it("should return empty array for unknown root", () => {
    const result = findRootMatches("xyzunknown");
    expect(result).toHaveLength(0);
  });
});

describe("findAffixMatches", () => {
  it("should find words with same prefix", () => {
    const result = findAffixMatches("unable");
    const prefixes = result.filter((r) => r.type === "prefix");
    expect(prefixes.some((p) => p.affix === "un")).toBe(true);
  });

  it("should find words with same suffix", () => {
    const result = findAffixMatches("education");
    const suffixes = result.filter((r) => r.type === "suffix");
    expect(suffixes.some((s) => s.affix === "tion")).toBe(true);
  });
});
