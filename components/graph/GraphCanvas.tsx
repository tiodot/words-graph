"use client";

import { useEffect, useRef, useCallback } from "react";
import ForceGraph3D, { type NodeObject, type LinkObject } from "3d-force-graph";
import * as THREE from "three";
import { EdgeType, GraphData } from "@/lib/types";

export type LayoutType = "force" | "spherical" | "random";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

interface ForceGraphNode {
  id: string;
  label: string;
  color: string;
  size: number;
  x?: number;
  y?: number;
  z?: number;
}

interface ForceGraphLink {
  source: string;
  target: string;
  color: string;
}

interface ForceGraphInstance {
  graphData(): { nodes: ForceGraphNode[]; links: ForceGraphLink[] };
  refresh(): void;
  _destructor?: () => void;
}

export function GraphCanvas({ data, onNodeClick, activeTypes, layout }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphInstance | null>(null);

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
    (graph: ForceGraphInstance) => {
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
      .nodeLabel("label")
      .nodeColor("color")
      .nodeVal("size")
      .linkColor((l: LinkObject) => (l as ForceGraphLink).color)
      .linkWidth(0.5)
      .linkDirectionalParticles(0)
      .backgroundColor("#0f0f0f")
      .onNodeClick((node: NodeObject) => {
        onNodeClick(String(node.id));
      })
      .nodeThreeObject((node: NodeObject) => {
        const n = node as NodeObject & { label: string; color: string };
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: createTextTexture(n.label, n.color),
            depthTest: false,
          })
        );
        sprite.scale.set(8, 4, 1);
        return sprite;
      });

    setTimeout(() => applyLayout(graph as unknown as ForceGraphInstance), 100);

    graphRef.current = graph as unknown as ForceGraphInstance;

    return () => {
      (graph as unknown as ForceGraphInstance)._destructor?.();
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

function createTextTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 256;
  canvas.height = 128;

  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
