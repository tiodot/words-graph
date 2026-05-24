import { prisma } from "./db";
import { findSimilarWords, editDistance } from "./similarity";
import { findRootMatches, findAffixMatches } from "./root-affix";
import { batchAnalyzeWords } from "./llm";
import { EDGE_COLORS } from "./types";
import type { GraphData, GraphNode, GraphEdge, EdgeType } from "./types";

export async function generateGraphData(wordbookId: number): Promise<void> {
  const words = await prisma.word.findMany({
    where: { wordbookId },
  });

  const wordTexts = words.map((w) => w.word);

  // Clear existing edges for this wordbook
  await prisma.edge.deleteMany({
    where: {
      sourceWord: { wordbookId },
    },
  });

  // 1. Character similarity
  const similarEdges = computeSimilarEdges(words);
  await saveEdges(similarEdges, "prebuilt");

  // 2. Root/affix matching
  const rootAffixEdges = computeRootAffixEdges(words);
  await saveEdges(rootAffixEdges, "prebuilt");

  // 3. LLM analysis (if configured)
  try {
    const llmEdges = await batchAnalyzeWords(wordTexts);
    await saveLLMEdges(llmEdges, words);
  } catch (error) {
    console.warn("LLM analysis skipped:", error);
  }

  // Update wordbook word count
  await prisma.wordbook.update({
    where: { id: wordbookId },
    data: { wordCount: words.length },
  });
}

function computeSimilarEdges(
  words: { id: number; word: string }[]
): { sourceId: number; targetId: number; type: EdgeType; weight: number }[] {
  const edges: { sourceId: number; targetId: number; type: EdgeType; weight: number }[] = [];
  const wordList = words.map((w) => w.word);

  for (let i = 0; i < words.length; i++) {
    const similar = findSimilarWords(words[i].word, wordList, 3);
    for (const simWord of similar) {
      const targetIdx = words.findIndex((w) => w.word === simWord);
      if (targetIdx > i) {
        const dist = editDistance(words[i].word.toLowerCase(), simWord.toLowerCase());
        edges.push({
          sourceId: words[i].id,
          targetId: words[targetIdx].id,
          type: "similar",
          weight: 1 - dist / 3,
        });
      }
    }
  }

  return edges;
}

function computeRootAffixEdges(
  words: { id: number; word: string }[]
): { sourceId: number; targetId: number; type: EdgeType; weight: number }[] {
  const edges: { sourceId: number; targetId: number; type: EdgeType; weight: number }[] = [];
  const wordMap = new Map(words.map((w) => [w.word.toLowerCase(), w.id]));

  for (const word of words) {
    // Root matches
    const rootMatches = findRootMatches(word.word);
    for (const match of rootMatches) {
      const targetId = wordMap.get(match.toLowerCase());
      if (targetId) {
        edges.push({ sourceId: word.id, targetId, type: "root", weight: 0.7 });
      }
    }

    // Affix matches
    const affixMatches = findAffixMatches(word.word);
    for (const affixMatch of affixMatches) {
      for (const match of affixMatch.words) {
        const targetId = wordMap.get(match.toLowerCase());
        if (targetId) {
          edges.push({
            sourceId: word.id,
            targetId,
            type: "affix",
            weight: 0.6,
          });
        }
      }
    }
  }

  return edges;
}

async function saveEdges(
  edges: { sourceId: number; targetId: number; type: string; weight: number }[],
  source: string
): Promise<void> {
  if (edges.length === 0) return;

  await prisma.edge.createMany({
    data: edges.map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      type: e.type,
      weight: e.weight,
      source,
    })),
    skipDuplicates: true,
  });
}

async function saveLLMEdges(
  llmEdges: { source: string; target: string; type: EdgeType; weight: number }[],
  words: { id: number; word: string }[]
): Promise<void> {
  const wordMap = new Map(words.map((w) => [w.word.toLowerCase(), w.id]));

  const edges = llmEdges
    .map((e) => ({
      sourceId: wordMap.get(e.source.toLowerCase())!,
      targetId: wordMap.get(e.target.toLowerCase())!,
      type: e.type,
      weight: e.weight,
    }))
    .filter((e) => e.sourceId && e.targetId);

  await saveEdges(edges, "llm");
}

export async function getGraphData(
  wordbookId: number,
  types?: EdgeType[]
): Promise<GraphData> {
  const words = await prisma.word.findMany({
    where: { wordbookId },
  });

  const edges = await prisma.edge.findMany({
    where: {
      sourceWord: { wordbookId },
      ...(types?.length ? { type: { in: types } } : {}),
    },
  });

  const nodes: GraphNode[] = words.map((w) => ({
    id: String(w.id),
    label: w.word,
    definition: w.definition ?? undefined,
    phonetic: w.phonetic ?? undefined,
    tags: w.tags as { mastered?: boolean; starred?: boolean } | undefined,
    size: 10,
    color: "#4f8cff",
  }));

  const graphEdges: GraphEdge[] = edges.map((e) => ({
    id: String(e.id),
    source: String(e.sourceId),
    target: String(e.targetId),
    type: e.type as EdgeType,
    weight: e.weight,
    color: EDGE_COLORS[e.type as EdgeType] || "#999",
    size: e.weight * 2,
  }));

  return { nodes, edges: graphEdges };
}
