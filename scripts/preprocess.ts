/**
 * 预处理脚本：生成图谱数据 JSON 文件
 *
 * 用法：
 *   npx tsx scripts/preprocess.ts [--no-llm]
 *
 * 环境变量：
 *   OPENAI_API_KEY 或 ANTHROPIC_API_KEY — 用于 LLM 分析
 */

import fs from "fs";
import path from "path";
import { findSimilarWords } from "../lib/similarity";
import { findRootMatches, findAffixMatches } from "../lib/root-affix";
import { batchAnalyzeWords } from "../lib/llm";
import { GraphNode, GraphEdge, EdgeType, EDGE_COLORS } from "../lib/types";

interface WordEntry {
  word: string;
  phonetic?: string;
  definition?: string;
}

interface WordbookGraph {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const WORDBOOKS_DIR = path.join(__dirname, "../public/wordbooks");
const OUTPUT_DIR = path.join(__dirname, "../public/graphs");

const COLORS = {
  word: "#4f8cff",
  similar: "#e91e63",
  root: "#9c27b0",
  affix: "#00bcd4",
  semantic: "#4f8cff",
  location: "#43a047",
  scene: "#ff9800",
};

const EDGE_WEIGHTS: Record<string, number> = {
  semantic: 3,
  root: 2.5,
  affix: 2,
  scene: 1.5,
  location: 1.5,
  similar: 1,
};

function getNodeColor(nodeId: string, edges: GraphEdge[]): string {
  const counts = new Map<string, number>();
  for (const e of edges) {
    if (e.source === nodeId || e.target === nodeId) {
      counts.set(e.type, (counts.get(e.type) || 0) + 1);
    }
  }
  let maxType: string | null = null;
  let maxCount = 0;
  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  }
  return maxType ? EDGE_COLORS[maxType as EdgeType] : "#4f8cff";
}

function getNodeSize(nodeId: string, edges: GraphEdge[]): number {
  const count = edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  ).length;
  return Math.max(8, Math.min(20, 8 + count * 1.5));
}

async function processWordbook(
  name: string,
  words: WordEntry[],
  useLLM: boolean
): Promise<WordbookGraph> {
  console.log(`\n处理: ${name} (${words.length} 词)`);

  // Build nodes
  const nodes: GraphNode[] = words.map((w, i) => ({
    id: String(i),
    label: w.word,
    definition: w.definition,
    phonetic: w.phonetic,
    size: 10,
    color: COLORS.word,
  }));

  const wordList = words.map((w) => w.word);
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(
    source: number,
    target: number,
    type: string,
    color: string
  ) {
    const [s, t] = source < target ? [source, target] : [target, source];
    const key = `${s}-${t}-${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: `${edges.length}`,
      source: String(s),
      target: String(t),
      type: type as any,
      weight: EDGE_WEIGHTS[type] || 1,
      color,
      size: 1,
    });
  }

  // 1. Similarity edges (edit distance ≤ 3, max 5 per word)
  console.log("  计算字符相似度...");
  for (let i = 0; i < wordList.length; i++) {
    const similar = findSimilarWords(wordList[i], wordList, 3);
    const limited = similar.slice(0, 5);
    for (const s of limited) {
      const j = wordList.indexOf(s);
      if (j > i) {
        addEdge(i, j, "similar", COLORS.similar);
      }
    }
  }
  console.log(`  相似度边: ${edges.length}`);

  // 2. Root edges
  console.log("  匹配词根...");
  for (let i = 0; i < wordList.length; i++) {
    const roots = findRootMatches(wordList[i]);
    for (const root of roots) {
      const j = wordList.indexOf(root);
      if (j >= 0 && j !== i) {
        addEdge(i, j, "root", COLORS.root);
      }
    }
  }
  console.log(`  含词根边: ${edges.length}`);

  // 3. Affix edges
  console.log("  匹配词缀...");
  for (let i = 0; i < wordList.length; i++) {
    const affixMatches = findAffixMatches(wordList[i]);
    for (const match of affixMatches) {
      for (const relatedWord of match.words) {
        const j = wordList.indexOf(relatedWord);
        if (j >= 0 && j !== i) {
          addEdge(i, j, "affix", COLORS.affix);
        }
      }
    }
  }
  console.log(`  含词缀边: ${edges.length}`);

  // 4. LLM edges
  if (useLLM) {
    console.log("  调用 LLM 分析语义/场景/地点关联...");
    try {
      const llmEdges = await batchAnalyzeWords(wordList, 30);
      for (const e of llmEdges) {
        const sourceIdx = wordList.indexOf(e.source);
        const targetIdx = wordList.indexOf(e.target);
        if (sourceIdx >= 0 && targetIdx >= 0) {
          const color =
            e.type === "semantic"
              ? COLORS.semantic
              : e.type === "location"
              ? COLORS.location
              : COLORS.scene;
          addEdge(sourceIdx, targetIdx, e.type, color);
        }
      }
      console.log(`  含 LLM 边: ${edges.length}`);
    } catch (err) {
      console.warn(`  LLM 分析失败: ${err}`);
    }
  }

  // Assign node colors and sizes based on edges
  for (const node of nodes) {
    node.color = getNodeColor(node.id, edges);
    node.size = getNodeSize(node.id, edges);
  }

  return { name, nodes, edges };
}

async function main() {
  const useLLM = !process.argv.includes("--no-llm");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(WORDBOOKS_DIR)
    .filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const name = path.basename(file, ".json");
    const words: WordEntry[] = JSON.parse(
      fs.readFileSync(path.join(WORDBOOKS_DIR, file), "utf-8")
    );

    const graph = await processWordbook(name, words, useLLM);

    const outPath = path.join(OUTPUT_DIR, `${name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));
    console.log(`  -> ${outPath}`);
  }

  console.log("\n完成!");
}

main().catch(console.error);
