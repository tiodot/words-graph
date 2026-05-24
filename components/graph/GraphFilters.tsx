"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, EdgeType } from "@/lib/types";

interface GraphFiltersProps {
  activeTypes: EdgeType[];
  onToggle: (type: EdgeType) => void;
}

const allTypes: EdgeType[] = ["semantic", "location", "scene", "similar", "root", "affix"];

export function GraphFilters({ activeTypes, onToggle }: GraphFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {allTypes.map((type) => (
        <button
          key={type}
          onClick={() => onToggle(type)}
          className="px-3 py-1 rounded-full text-xs border transition-colors"
          style={{
            backgroundColor: activeTypes.includes(type)
              ? `${EDGE_COLORS[type]}22`
              : "transparent",
            borderColor: activeTypes.includes(type)
              ? `${EDGE_COLORS[type]}44`
              : "#3a3a3a",
            color: activeTypes.includes(type) ? EDGE_COLORS[type] : "#888",
          }}
        >
          {EDGE_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
