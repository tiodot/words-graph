import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { EdgeType } from "./types";

interface LLMEdge {
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
}

interface LLMResponse {
  edges: LLMEdge[];
}

interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
}

function getProvider(config: LLMConfig) {
  switch (config.provider) {
    case "openai":
      return createOpenAI({ apiKey: config.apiKey })(config.model);
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey })(config.model);
    default:
      return createOpenAI({ apiKey: config.apiKey, baseURL: config.provider })(config.model);
  }
}

function getLLMConfig(): LLMConfig {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  const model = process.env.LLM_MODEL || (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");

  if (!apiKey) throw new Error("LLM API key not set. Use LLM_API_KEY env var.");

  return { provider, apiKey, model };
}

export async function analyzeWordRelations(
  words: string[],
  config?: LLMConfig
): Promise<LLMEdge[]> {
  const llmConfig = config || getLLMConfig();
  const provider = getProvider(llmConfig);

  const prompt = `分析以下单词之间的关联关系，返回 JSON 格式：

单词列表：${JSON.stringify(words)}

请分析以下类型的关联：
1. semantic — 语义相关（同义、反义、上下位）
2. location — 地点相关（常一起出现的场所）
3. scene — 场景相关（常一起出现的活动场景）

只返回有明显关联的单词对。每个关联需要一个 0-1 之间的权重值表示关联强度。

返回格式（仅返回 JSON，不要其他内容）：
{
  "edges": [
    {"source": "word1", "target": "word2", "type": "semantic", "weight": 0.8}
  ]
}`;

  const { text } = await generateText({
    model: provider,
    prompt,
    temperature: 0.3,
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const result: LLMResponse = JSON.parse(jsonMatch[0]);
    return result.edges;
  } catch {
    console.error("Failed to parse LLM response:", text);
    throw new Error("Failed to parse LLM response");
  }
}

export async function batchAnalyzeWords(
  words: string[],
  batchSize: number = 30,
  config?: LLMConfig
): Promise<LLMEdge[]> {
  const allEdges: LLMEdge[] = [];

  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    try {
      const edges = await analyzeWordRelations(batch, config);
      allEdges.push(...edges);
    } catch (error) {
      console.error(`Batch ${i}-${i + batchSize} failed:`, error);
    }
  }

  return allEdges;
}
