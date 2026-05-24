"use client";

import { useEffect, useRef } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import circular from "graphology-layout/circular";
import random from "graphology-layout/random";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { EdgeType, GraphData } from "@/lib/types";

export type LayoutType = "force" | "circular" | "random";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

function applyLayout(graph: Graph, layout: LayoutType) {
  switch (layout) {
    case "circular":
      circular.assign(graph);
      break;
    case "random":
      random.assign(graph);
      break;
    case "force":
      // Start with random positions
      random.assign(graph);
      // Run forceatlas2 synchronously
      forceAtlas2.assign(graph, {
        iterations: 50,
        settings: {
          gravity: 10,
          scalingRatio: 10,
          edgeWeightInfluence: 0,
        },
      });
      break;
  }
}

export function GraphCanvas({ data, onNodeClick, activeTypes, layout }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({ multi: true });

    // Add nodes
    data.nodes.forEach((node) => {
      graph.addNode(node.id, {
        label: node.label,
        x: 0,
        y: 0,
        size: node.size,
        color: node.color,
      });
    });

    // Add edges (filtered by active types)
    data.edges
      .filter((edge) => activeTypes.includes(edge.type))
      .forEach((edge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
            color: edge.color,
            size: edge.size,
          });
        }
      });

    // Apply layout
    applyLayout(graph, layout);

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
  }, [data, activeTypes, onNodeClick, layout]);

  return <div ref={containerRef} className="w-full h-full" />;
}
