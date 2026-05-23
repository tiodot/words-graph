import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";
import { decrypt } from "./crypto";
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

function getProvider(provider: string, apiKey: string, model: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    default:
      return createOpenAI({ apiKey, baseURL: provider })(model);
  }
}

export async function analyzeWordRelations(
  words: string[]
): Promise<LLMEdge[]> {
  const settings = await prisma.userSettings.findFirst();
  if (!settings?.apiKey || !settings?.provider || !settings?.model) {
    throw new Error("LLM settings not configured");
  }

  const apiKey = decrypt(settings.apiKey);
  const provider = getProvider(settings.provider, apiKey, settings.model);

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
  } catch (error) {
    console.error("Failed to parse LLM response:", text);
    throw new Error("Failed to parse LLM response");
  }
}

export async function batchAnalyzeWords(
  words: string[],
  batchSize: number = 30
): Promise<LLMEdge[]> {
  const allEdges: LLMEdge[] = [];

  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    try {
      const edges = await analyzeWordRelations(batch);
      allEdges.push(...edges);
    } catch (error) {
      console.error(`Batch ${i}-${i + batchSize} failed:`, error);
    }
  }

  return allEdges;
}
