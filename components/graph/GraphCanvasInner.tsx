"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { EdgeType, GraphData } from "@/lib/types";

export type LayoutType = "force" | "spherical" | "random";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

function computePositions(nodes: { id: string }[], edges: { source: string; target: string }[], layout: LayoutType) {
  const map = new Map<string, THREE.Vector3>();
  const n = nodes.length;
  if (n === 0) return map;

  if (layout === "spherical") {
    const radius = Math.max(30, Math.sqrt(n) * 5);
    nodes.forEach((node, i) => {
      const phi = Math.acos(-1 + (2 * i) / n);
      const theta = Math.sqrt(n * Math.PI) * phi;
      map.set(node.id, new THREE.Vector3(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      ));
    });
  } else if (layout === "random") {
    nodes.forEach((node) => {
      map.set(node.id, new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100
      ));
    });
  } else {
    // Force-directed
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      const r = 20 + Math.random() * 30;
      map.set(node.id, new THREE.Vector3(
        r * Math.cos(angle),
        (Math.random() - 0.5) * 40,
        r * Math.sin(angle)
      ));
    });

    for (let iter = 0; iter < 80; iter++) {
      const forces = new Map<string, THREE.Vector3>();
      nodes.forEach((n) => forces.set(n.id, new THREE.Vector3()));

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = map.get(nodes[i].id)!;
          const b = map.get(nodes[j].id)!;
          const diff = new THREE.Vector3().subVectors(a, b);
          const dist = Math.max(diff.length(), 1);
          const force = diff.normalize().multiplyScalar(500 / (dist * dist));
          forces.get(nodes[i].id)!.add(force);
          forces.get(nodes[j].id)!.sub(force);
        }
      }

      for (const edge of edges) {
        const a = map.get(edge.source);
        const b = map.get(edge.target);
        if (!a || !b) continue;
        const diff = new THREE.Vector3().subVectors(b, a);
        const dist = diff.length();
        const force = diff.normalize().multiplyScalar(dist * 0.01);
        forces.get(edge.source)?.add(force);
        forces.get(edge.target)?.sub(force);
      }

      nodes.forEach((n) => {
        const pos = map.get(n.id)!;
        pos.add(forces.get(n.id)!.multiplyScalar(0.5));
        pos.x = Math.max(-200, Math.min(200, pos.x));
        pos.y = Math.max(-200, Math.min(200, pos.y));
        pos.z = Math.max(-200, Math.min(200, pos.z));
      });
    }
  }

  return map;
}

function GraphNode({ id, label, color, position, onClick }: {
  id: string;
  label: string;
  color: string;
  position: THREE.Vector3;
  onClick: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const s = hovered ? 1.3 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={hovered ? color : "#000000"}
          emissiveIntensity={hovered ? 0.5 : 0}
        />
      </mesh>
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.8}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}

function GraphEdges({ edges, positions }: {
  edges: { source: string; target: string; color: string }[];
  positions: Map<string, THREE.Vector3>;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (const edge of edges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (a && b) {
        points.push(a, b);
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [edges, positions]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#333344" transparent opacity={0.6} />
    </lineSegments>
  );
}

function Scene({ data, onNodeClick, positions }: {
  data: GraphData;
  onNodeClick: (id: string) => void;
  positions: Map<string, THREE.Vector3>;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={1} />
      <GraphEdges edges={data.edges} positions={positions} />
      {data.nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return (
          <GraphNode
            key={node.id}
            id={node.id}
            label={node.label}
            color={node.color}
            position={pos}
            onClick={onNodeClick}
          />
        );
      })}
      <OrbitControls enableDamping dampingFactor={0.1} />
    </>
  );
}

export default function GraphCanvasInner({ data, onNodeClick, activeTypes, layout }: GraphCanvasProps) {
  const filteredEdges = data.edges.filter((e) => activeTypes.includes(e.type));
  const filteredData = useMemo(() => ({
    nodes: data.nodes,
    edges: filteredEdges,
  }), [data.nodes, filteredEdges]);

  const positions = useMemo(
    () => computePositions(filteredData.nodes, filteredData.edges, layout),
    [filteredData.nodes, filteredData.edges, layout]
  );

  const handleNodeClick = useCallback((id: string) => {
    onNodeClick(id);
  }, [onNodeClick]);

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 80], fov: 60 }}>
        <Scene data={filteredData} onNodeClick={handleNodeClick} positions={positions} />
      </Canvas>
    </div>
  );
}
