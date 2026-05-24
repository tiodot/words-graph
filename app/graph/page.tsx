"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphFilters } from "@/components/graph/GraphFilters";
import { WordDetail } from "@/components/graph/WordDetail";
import { GraphData, EdgeType } from "@/lib/types";

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-56px)]"><p className="text-gray-500">加载中...</p></div>}>
      <GraphContent />
    </Suspense>
  );
}

function GraphContent() {
  const searchParams = useSearchParams();
  const wordbookId = searchParams.get("wordbook");

  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<EdgeType[]>([
    "semantic", "location", "scene", "similar", "root", "affix",
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGraphData = useCallback(async () => {
    const typesParam = activeTypes.join(",");
    const res = await fetch(
      `/api/graph?wordbook_id=${wordbookId}&types=${typesParam}`
    );
    const result = await res.json();
    if (result.success) {
      setData(result.data);
    }
  }, [wordbookId, activeTypes]);

  useEffect(() => {
    if (wordbookId) {
      fetchGraphData();
    }
  }, [wordbookId, activeTypes, fetchGraphData]);

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
