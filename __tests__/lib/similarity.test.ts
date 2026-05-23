import { describe, it, expect } from "vitest";
import { editDistance, findSimilarWords } from "@/lib/similarity";

describe("editDistance", () => {
  it("should return 0 for identical strings", () => {
    expect(editDistance("hello", "hello")).toBe(0);
  });

  it("should return correct distance for single edit", () => {
    expect(editDistance("hello", "hallo")).toBe(1);
    expect(editDistance("hello", "hell")).toBe(1);
    expect(editDistance("hello", "helloo")).toBe(1);
  });

  it("should return correct distance for multiple edits", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("book", "cook")).toBe(1);
    expect(editDistance("book", "look")).toBe(1);
  });
});

describe("findSimilarWords", () => {
  it("should find words within edit distance threshold", () => {
    const words = ["book", "cook", "look", "room", "cool"];
    const result = findSimilarWords("book", words, 1);
    expect(result).toContain("cook");
    expect(result).toContain("look");
    expect(result).not.toContain("room");
    expect(result).not.toContain("cool");
  });

  it("should not include the word itself", () => {
    const words = ["book", "cook"];
    const result = findSimilarWords("book", words, 1);
    expect(result).not.toContain("book");
  });

  it("should respect threshold", () => {
    const words = ["book", "bok", "bo"];
    const result = findSimilarWords("book", words, 2);
    expect(result).toContain("bok");
    expect(result).toContain("bo");
  });
});
