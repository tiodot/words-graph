"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, GraphData, EdgeType } from "@/lib/types";

interface WordDetailProps {
  nodeId: string;
  data: GraphData;
  onClose: () => void;
  onWordClick: (nodeId: string) => void;
}

export function WordDetail({ nodeId, data, onClose, onWordClick }: WordDetailProps) {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const relatedEdges = data.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );

  const relatedWords = relatedEdges.map((edge) => {
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const otherNode = data.nodes.find((n) => n.id === otherId);
    return {
      id: otherId,
      word: otherNode?.label || "",
      type: edge.type as EdgeType,
    };
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold">{node.label}</h2>
          {node.phonetic && (
            <p className="text-gray-400 text-sm">{node.phonetic}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {node.definition && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">释义</p>
          <p className="text-sm">{node.definition}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <p className="text-xs text-gray-500 mb-2">关联单词</p>
        <div className="space-y-2">
          {relatedWords.map((word, i) => (
            <button
              key={i}
              onClick={() => onWordClick(word.id)}
              className="flex justify-between items-center w-full hover:bg-[#2a2a2a] rounded px-1 py-0.5 transition-colors text-left"
            >
              <span style={{ color: EDGE_COLORS[word.type] }}>
                ● {word.word}
              </span>
              <span className="text-xs text-gray-500">
                {EDGE_TYPE_LABELS[word.type]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
        <p className="text-xs text-gray-500 mb-2">学习状态</p>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded text-xs bg-[#43a04722] text-[#43a047] border border-[#43a04744]">
            已掌握
          </button>
          <button className="px-3 py-1 rounded text-xs bg-[#2a2a2a] text-gray-400 border border-[#3a3a3a]">
            未掌握
          </button>
        </div>
      </div>
    </div>
  );
}
