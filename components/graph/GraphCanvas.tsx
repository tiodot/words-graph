"use client";

import dynamic from "next/dynamic";
import { EdgeType, GraphData } from "@/lib/types";

export type LayoutType = "force" | "spherical";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

const GraphCanvasInner = dynamic(() => import("./GraphCanvasInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-gray-500">加载 3D 场景...</p>
    </div>
  ),
});

export function GraphCanvas(props: GraphCanvasProps) {
  return <GraphCanvasInner {...props} />;
}
