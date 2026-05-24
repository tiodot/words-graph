"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface WordbookInfo {
  name: string;
  label: string;
  wordCount: number;
}

const WORDBOOKS: WordbookInfo[] = [
  { name: "CET4", label: "大学英语四级", wordCount: 4543 },
  { name: "CET6", label: "大学英语六级", wordCount: 2166 },
  { name: "TOEFL", label: "托福词汇", wordCount: 4516 },
  { name: "GRE", label: "GRE 词汇", wordCount: 7733 },
];

export default function WordbooksPage() {
  const router = useRouter();
  const [available, setAvailable] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check which graph files exist
    Promise.all(
      WORDBOOKS.map((wb) =>
        fetch(`/graphs/${wb.name}.json`, { method: "HEAD" })
          .then((res) => (res.ok ? wb.name : null))
          .catch(() => null)
      )
    ).then((results: (string | null)[]) => {
      setAvailable(new Set(results.filter(Boolean) as string[]));
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">单词书</h1>

      <div className="grid gap-4">
        {WORDBOOKS.map((wb) => (
          <div
            key={wb.name}
            className="bg-[#1a1a1a] p-4 rounded-lg border border-[#2a2a2a] flex items-center justify-between"
          >
            <div>
              <h3 className="font-medium">{wb.label}</h3>
              <p className="text-sm text-gray-400">{wb.wordCount} 词</p>
            </div>
            <button
              onClick={() => router.push(`/graph?wordbook=${wb.name}`)}
              disabled={!available.has(wb.name)}
              className="px-4 py-2 bg-[#4f8cff] text-white rounded text-sm hover:bg-[#3a7aee] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {available.has(wb.name) ? "查看图谱" : "未生成"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
        <h2 className="font-semibold mb-2">生成图谱数据</h2>
        <p className="text-sm text-gray-400 mb-4">
          运行预处理脚本生成图谱 JSON 文件：
        </p>
        <code className="block bg-[#0f0f0f] p-3 rounded text-sm text-green-400">
          npx tsx scripts/preprocess.ts
        </code>
        <p className="text-xs text-gray-500 mt-2">
          添加 --no-llm 跳过 LLM 分析（仅计算相似度、词根、词缀）
        </p>
      </div>
    </div>
  );
}
