"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GraphCanvas, LayoutType } from "@/components/graph/GraphCanvas";
import { GraphFilters } from "@/components/graph/GraphFilters";
import { WordDetail } from "@/components/graph/WordDetail";
import { GraphData, EdgeType } from "@/lib/types";

const LAYOUT_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: "force", label: "力导向" },
  { value: "circular", label: "环形" },
  { value: "random", label: "随机" },
];

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-56px)]"><p className="text-gray-500">加载中...</p></div>}>
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

  // Filter edges by active types
  const data: GraphData | null = fullData
    ? {
        nodes: fullData.nodes,
        edges: fullData.edges.filter((e) => activeTypes.includes(e.type)),
      }
    : null;

  const handleToggleType = useCallback((type: EdgeType) => {
    setActiveTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  if (!wordbookId) {
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
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <div className="w-64 bg-[#1a1a1a] border-r border-[#2a2a2a] p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">布局方式</h3>
          <div className="flex gap-2">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLayout(opt.value)}
                className={`px-3 py-1 rounded text-xs border transition-colors ${
                  layout === opt.value
                    ? "bg-[#4f8cff22] border-[#4f8cff44] text-[#4f8cff]"
                    : "border-[#3a3a3a] text-gray-400 hover:border-[#4a4a4a]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">筛选关联</h3>
          <GraphFilters activeTypes={activeTypes} onToggle={handleToggleType} />
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">搜索</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索单词..."
            className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        <GraphCanvas
          data={data}
          onNodeClick={handleNodeClick}
          activeTypes={activeTypes}
          layout={layout}
        />
      </div>

      {/* Detail Panel */}
      {selectedNode && (
        <div className="w-72 bg-[#1a1a1a] border-l border-[#2a2a2a] p-4">
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
