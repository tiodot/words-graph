"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, EdgeType } from "@/lib/types";

interface GraphFiltersProps {
  activeTypes: EdgeType[];
  onToggle: (type: EdgeType) => void;
}

const allTypes: EdgeType[] = [
  "semantic", "location", "scene", "similar", "root", "affix",
];

export function GraphFilters({ activeTypes, onToggle }: GraphFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      {allTypes.map((type) => {
        const isActive = activeTypes.includes(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            title={EDGE_TYPE_LABELS[type]}
            className="w-4 h-4 rounded-full transition-all hover:scale-125"
            style={{
              backgroundColor: EDGE_COLORS[type],
              opacity: isActive ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}
