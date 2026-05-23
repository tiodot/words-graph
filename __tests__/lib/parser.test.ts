import { describe, it, expect } from "vitest";
import { parseWordbook, detectFormat } from "@/lib/parser";

describe("detectFormat", () => {
  it("should detect moomoo CSV format", () => {
    const content = "word,definition\nabandon,放弃";
    expect(detectFormat("vocab.csv", content)).toBe("moomoo");
  });

  it("should detect JSON format", () => {
    const content = '[{"word":"abandon","definition":"放弃"}]';
    expect(detectFormat("vocab.json", content)).toBe("json");
  });

  it("should detect plain text format", () => {
    const content = "abandon\nabstract\nacademic";
    expect(detectFormat("vocab.txt", content)).toBe("text");
  });
});

describe("parseWordbook", () => {
  it("should parse moomoo CSV", () => {
    const content = "word,definition,phonetic\nabandon,放弃,/əˈbændən/\nabstract,抽象,ˈæbstrækt";
    const result = parseWordbook("moomoo", content);
    expect(result.words).toHaveLength(2);
    expect(result.words[0]).toEqual({
      word: "abandon",
      definition: "放弃",
      phonetic: "/əˈbændən/",
    });
  });

  it("should parse buBei JSON", () => {
    const content = JSON.stringify([
      { word: "abandon", meaning: "放弃", phonetic: "/əˈbændən/" },
      { word: "abstract", meaning: "抽象", phonetic: "/ˈæbstrækt/" },
    ]);
    const result = parseWordbook("bubei", content);
    expect(result.words).toHaveLength(2);
    expect(result.words[0].word).toBe("abandon");
  });

  it("should parse plain text", () => {
    const content = "abandon\nabstract\nacademic";
    const result = parseWordbook("text", content);
    expect(result.words).toHaveLength(3);
    expect(result.words[0]).toEqual({ word: "abandon", definition: undefined, phonetic: undefined });
  });

  it("should parse generic CSV with column mapping", () => {
    const content = "term,meaning\nabandon,放弃";
    const result = parseWordbook("csv", content, { wordColumn: 0, definitionColumn: 1 });
    expect(result.words).toHaveLength(1);
    expect(result.words[0].definition).toBe("放弃");
  });
});
