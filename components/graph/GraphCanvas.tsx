"use client";

import { useEffect, useRef, useCallback } from "react";
import ForceGraph3D, { type NodeObject, type LinkObject, type ForceGraph3DInstance } from "3d-force-graph";
import { EdgeType, GraphData } from "@/lib/types";

export type LayoutType = "force" | "spherical" | "random";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

interface ForceGraphLink {
  source: string;
  target: string;
  color: string;
}

export function GraphCanvas({ data, onNodeClick, activeTypes, layout }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);
  const hoveredRef = useRef<string | null>(null);

  const filteredEdges = data.edges.filter((e) => activeTypes.includes(e.type));

  const graphData = {
    nodes: data.nodes.map((n) => ({ ...n })),
    links: filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      color: e.color + "80",
    })),
  };

  const applyLayout = useCallback(
    (graph: ForceGraph3DInstance) => {
      if (layout === "spherical") {
        const n = data.nodes.length;
        const radius = Math.max(50, Math.sqrt(n) * 8);
        const nodes = graph.graphData().nodes;
        data.nodes.forEach((_, i) => {
          const phi = Math.acos(-1 + (2 * i) / n);
          const theta = Math.sqrt(n * Math.PI) * phi;
          const node = nodes[i];
          if (node) {
            node.x = radius * Math.cos(theta) * Math.sin(phi);
            node.y = radius * Math.sin(theta) * Math.sin(phi);
            node.z = radius * Math.cos(phi);
          }
        });
        graph.refresh();
      } else if (layout === "random") {
        const nodes = graph.graphData().nodes;
        data.nodes.forEach((_, i) => {
          const node = nodes[i];
          if (node) {
            node.x = (Math.random() - 0.5) * 200;
            node.y = (Math.random() - 0.5) * 200;
            node.z = (Math.random() - 0.5) * 200;
          }
        });
        graph.refresh();
      }
    },
    [data.nodes, layout]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new ForceGraph3D(containerRef.current)
      .graphData(graphData)
      .nodeLabel((node: NodeObject) => {
        const n = node as NodeObject & { label: string; definition?: string };
        return `<div style="background:#1a1a1a;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;">
          <strong>${n.label}</strong>${n.definition ? `<br/>${n.definition}` : ""}
        </div>`;
      })
      .nodeColor("color")
      .nodeVal("size")
      .linkColor((l: LinkObject) => (l as ForceGraphLink).color)
      .linkWidth(0.5)
      .linkDirectionalParticles(0)
      .backgroundColor("#0f0f0f")
      .onNodeHover((node: NodeObject | null) => {
        hoveredRef.current = node ? String(node.id) : null;
      });

    // Handle click manually: if a node is hovered, select it
    const handleClick = (e: MouseEvent) => {
      if (hoveredRef.current !== null) {
        e.preventDefault();
        e.stopPropagation();
        onNodeClick(hoveredRef.current);
      }
    };
    containerRef.current.addEventListener("click", handleClick, { capture: true });

    setTimeout(() => applyLayout(graph), 100);

    graphRef.current = graph;

    return () => {
      containerRef.current?.removeEventListener("click", handleClick);
      graph._destructor();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeTypes]);

  useEffect(() => {
    if (graphRef.current) {
      applyLayout(graphRef.current);
    }
  }, [layout, applyLayout]);

  return <div ref={containerRef} className="w-full h-full" />;
}
