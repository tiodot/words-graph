"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GraphCanvas, LayoutType } from "@/components/graph/GraphCanvas";
import { GraphFilters } from "@/components/graph/GraphFilters";
import { WordDetail } from "@/components/graph/WordDetail";
import { GraphData, EdgeType } from "@/lib/types";

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <p className="text-gray-500">加载中...</p>
        </div>
      }
    >
      <GraphContent />
    </Suspense>
  );
}

function GraphContent() {
  const searchParams = useSearchParams();
  const wordbook = searchParams.get("wordbook");

  const [fullData, setFullData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<EdgeType[]>([
    "semantic", "location", "scene", "similar", "root", "affix",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [layout, setLayout] = useState<LayoutType>("force");

  useEffect(() => {
    if (wordbook) {
      fetch(`/graphs/${wordbook}.json`)
        .then((res) => res.json())
        .then((graph) => setFullData(graph))
        .catch(() => setFullData(null));
    }
  }, [wordbook]);

  const data: GraphData | null = fullData
    ? {
        nodes: fullData.nodes,
        edges: fullData.edges.filter((e) => activeTypes.includes(e.type)),
      }
    : null;

  const handleToggleType = useCallback((type: EdgeType) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  if (!wordbook) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">请先选择一本单词书</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-56px)] overflow-hidden">
      {/* Top toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
          {/* Layout switcher */}
          <div className="flex gap-1 bg-[#111] rounded-full p-0.5">
            {(["force", "spherical"] as LayoutType[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setLayout(opt)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  layout === opt
                    ? "bg-[#4f8cff15] border border-[#4f8cff30] text-[#4f8cff]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {opt === "force" ? "力导向" : "球形"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[#2a2a2a]" />

          {/* Edge type dots */}
          <GraphFilters activeTypes={activeTypes} onToggle={handleToggleType} />

          <div className="w-px h-5 bg-[#2a2a2a]" />

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#2a2a2a] border border-[#333] rounded-full px-3 py-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索单词..."
              className="bg-transparent text-sm text-white placeholder:text-gray-600 outline-none w-32"
            />
          </div>
        </div>
      </div>

      {/* Fullscreen 3D graph */}
      <GraphCanvas data={data} onNodeClick={handleNodeClick} activeTypes={activeTypes} layout={layout} />

      {/* Floating detail card */}
      {selectedNode && (
        <div className="absolute top-20 right-4 z-20">
          <WordDetail
            nodeId={selectedNode}
            data={data}
            onClose={() => setSelectedNode(null)}
            onWordClick={handleNodeClick}
          />
        </div>
      )}
    </div>
  );
}
