"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { EdgeType, EDGE_COLORS, GraphData } from "@/lib/types";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
}

export function GraphCanvas({ data, onNodeClick, activeTypes }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph();

    // Add nodes
    data.nodes.forEach((node) => {
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 10,
        y: Math.random() * 10,
        size: node.size,
        color: node.color,
      });
    });

    // Add edges (filtered by active types)
    data.edges
      .filter((edge) => activeTypes.includes(edge.type))
      .forEach((edge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            color: edge.color,
            size: edge.size,
          });
        }
      });

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeColor: "#333",
      labelColor: { color: "#fff" },
    });

    sigma.on("clickNode", ({ node }) => {
      onNodeClick(node);
    });

    sigmaRef.current = sigma;

    return () => {
      sigma.kill();
    };
  }, [data, activeTypes, onNodeClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
