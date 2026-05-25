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
    <div className="w-72 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{node.label}</h2>
          {node.phonetic && (
            <p className="text-gray-500 text-xs mt-0.5">{node.phonetic}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#3a3a3a] transition-colors text-xs"
        >
          ×
        </button>
      </div>

      {/* Definition */}
      {node.definition && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-300 leading-relaxed">{node.definition}</p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-[#2a2a2a] mx-4" />

      {/* Related words */}
      <div className="p-4 pt-3">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
          关联单词
        </p>
        <div className="space-y-1 max-h-60 overflow-auto">
          {relatedWords.length === 0 ? (
            <p className="text-xs text-gray-600">暂无关联单词</p>
          ) : (
            relatedWords.map((word, i) => (
              <button
                key={i}
                onClick={() => onWordClick(word.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors text-left"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: EDGE_COLORS[word.type] }}
                />
                <span className="text-sm text-gray-300 flex-1">{word.word}</span>
                <span className="text-[10px]" style={{ color: EDGE_COLORS[word.type] }}>
                  {EDGE_TYPE_LABELS[word.type]}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
