import rootsData from "@/public/data/roots.json";
import affixesData from "@/public/data/affixes.json";

interface RootEntry {
  root: string;
  meaning: string;
  words: string[];
}

interface AffixEntry {
  prefix?: string;
  suffix?: string;
  meaning: string;
  example: string[];
}

export function findRootMatches(word: string): string[] {
  const wordLower = word.toLowerCase();
  const matches: string[] = [];

  for (const entry of rootsData as RootEntry[]) {
    if (wordLower.includes(entry.root)) {
      for (const relatedWord of entry.words) {
        if (relatedWord.toLowerCase() !== wordLower) {
          matches.push(relatedWord);
        }
      }
    }
  }

  return [...new Set(matches)];
}

export function findAffixMatches(
  word: string
): { affix: string; type: "prefix" | "suffix"; words: string[] }[] {
  const wordLower = word.toLowerCase();
  const results: { affix: string; type: "prefix" | "suffix"; words: string[] }[] = [];

  for (const entry of affixesData.prefixes as AffixEntry[]) {
    if (wordLower.startsWith(entry.prefix!)) {
      results.push({
        affix: entry.prefix!,
        type: "prefix",
        words: entry.example.filter((w) => w.toLowerCase() !== wordLower),
      });
    }
  }

  for (const entry of affixesData.suffixes as AffixEntry[]) {
    if (wordLower.endsWith(entry.suffix!)) {
      results.push({
        affix: entry.suffix!,
        type: "suffix",
        words: entry.example.filter((w) => w.toLowerCase() !== wordLower),
      });
    }
  }

  return results;
}
