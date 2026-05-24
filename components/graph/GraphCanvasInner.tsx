"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EdgeType, GraphData } from "@/lib/types";

export type LayoutType = "force" | "spherical" | "random";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

const EDGE_COLOR_MAP: Record<EdgeType, number> = {
  semantic: 0x6366f1,
  location: 0x22c55e,
  scene: 0xf59e0b,
  similar: 0xec4899,
  root: 0x3b82f6,
  affix: 0x8b5cf6,
};

function computePositions(nodes: { id: string }[], edges: { source: string; target: string }[], layout: LayoutType) {
  const map = new Map<string, [number, number, number]>();
  const n = nodes.length;
  if (n === 0) return map;

  if (layout === "spherical" || n > 500) {
    const radius = Math.max(40, Math.sqrt(n) * 6);
    nodes.forEach((node, i) => {
      const phi = Math.acos(-1 + (2 * i) / n);
      const theta = Math.sqrt(n * Math.PI) * phi;
      map.set(node.id, [
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi),
      ]);
    });
  } else if (layout === "random") {
    nodes.forEach((node) => {
      map.set(node.id, [
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 120,
      ]);
    });
  } else {
    // Force-directed
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      const r = 25 + Math.random() * 35;
      map.set(node.id, [
        r * Math.cos(angle),
        (Math.random() - 0.5) * 50,
        r * Math.sin(angle),
      ]);
    });

    const iters = Math.min(60, Math.max(15, Math.floor(2500 / n)));
    for (let iter = 0; iter < iters; iter++) {
      const forces = new Map<string, [number, number, number]>();
      nodes.forEach((n) => forces.set(n.id, [0, 0, 0]));

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = map.get(nodes[i].id)!;
          const b = map.get(nodes[j].id)!;
          const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1);
          const f = 600 / (dist * dist);
          const fx = (dx / dist) * f, fy = (dy / dist) * f, fz = (dz / dist) * f;
          const fa = forces.get(nodes[i].id)!;
          const fb = forces.get(nodes[j].id)!;
          fa[0] += fx; fa[1] += fy; fa[2] += fz;
          fb[0] -= fx; fb[1] -= fy; fb[2] -= fz;
        }
      }

      for (const edge of edges) {
        const a = map.get(edge.source);
        const b = map.get(edge.target);
        if (!a || !b) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const fx = dx * 0.012, fy = dy * 0.012, fz = dz * 0.012;
        const fa = forces.get(edge.source)!;
        const fb = forces.get(edge.target)!;
        fa[0] += fx; fa[1] += fy; fa[2] += fz;
        fb[0] -= fx; fb[1] -= fy; fb[2] -= fz;
      }

      nodes.forEach((n) => {
        const pos = map.get(n.id)!;
        const f = forces.get(n.id)!;
        pos[0] = Math.max(-250, Math.min(250, pos[0] + f[0] * 0.5));
        pos[1] = Math.max(-250, Math.min(250, pos[1] + f[1] * 0.5));
        pos[2] = Math.max(-250, Math.min(250, pos[2] + f[2] * 0.5));
      });
    }
  }

  return map;
}

export default function GraphCanvasInner({ data, onNodeClick, activeTypes, layout }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredEdges = useMemo(
    () => data.edges.filter((e) => activeTypes.includes(e.type)),
    [data.edges, activeTypes]
  );

  const positions = useMemo(
    () => computePositions(data.nodes, filteredEdges, layout),
    [data.nodes, filteredEdges, layout]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const nodeCount = data.nodes.length;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 3000);
    camera.position.set(0, 20, 140);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.2;
    controls.minDistance = 15;
    controls.maxDistance = 600;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.rotateSpeed = 0.6;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(80, 120, 100);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0x4466ff, 0.3);
    backLight.position.set(-60, -40, -80);
    scene.add(backLight);

    // --- Nodes (InstancedMesh) ---
    const sphereGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x4f8cff,
      metalness: 0.2,
      roughness: 0.6,
      emissive: 0x112244,
      emissiveIntensity: 0.3,
    });
    const instancedMesh = new THREE.InstancedMesh(sphereGeo, nodeMat, nodeCount);
    const dummy = new THREE.Object3D();
    const colorArray = new Float32Array(nodeCount * 3);
    const tempColor = new THREE.Color();

    data.nodes.forEach((node, i) => {
      const pos = positions.get(node.id);
      if (!pos) return;
      dummy.position.set(pos[0], pos[1], pos[2]);
      // Vary size slightly based on number of edges
      const edgeCount = data.edges.filter(e => e.source === node.id || e.target === node.id).length;
      const scale = 1.0 + Math.min(edgeCount * 0.1, 1.0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
      tempColor.set(node.color);
      colorArray[i * 3] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    scene.add(instancedMesh);

    // --- Hover ring (hidden by default) ---
    const ringGeo = new THREE.RingGeometry(2.2, 2.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const hoverRing = new THREE.Mesh(ringGeo, ringMat);
    hoverRing.visible = false;
    scene.add(hoverRing);

    // --- Edge lines ---
    const edgeLines: THREE.LineSegments[] = [];
    if (filteredEdges.length > 0) {
      // Group edges by type for different colors
      const edgesByType = new Map<EdgeType, number[]>();
      for (const edge of filteredEdges) {
        const a = positions.get(edge.source);
        const b = positions.get(edge.target);
        if (!a || !b) continue;
        if (!edgesByType.has(edge.type)) edgesByType.set(edge.type, []);
        edgesByType.get(edge.type)!.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
      for (const [type, points] of edgesByType) {
        if (points.length === 0) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
        const mat = new THREE.LineBasicMaterial({
          color: EDGE_COLOR_MAP[type] || 0x333344,
          transparent: true,
          opacity: 0.25,
          linewidth: 1,
        });
        const line = new THREE.LineSegments(geo, mat);
        scene.add(line);
        edgeLines.push(line);
      }
    }

    // --- Labels on canvas texture ---
    const labelCanvas = document.createElement("canvas");
    const labelCtx = labelCanvas.getContext("2d")!;
    labelCanvas.width = 2048;
    labelCanvas.height = 2048;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.scale.set(300, 300, 1);
    labelSprite.position.set(0, 0, 0);
    scene.add(labelSprite);

    function updateLabels() {
      labelCtx.clearRect(0, 0, 2048, 2048);
      const camPos = camera.position;

      const sorted = data.nodes
        .map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const dx = pos[0] - camPos.x;
          const dy = pos[1] - camPos.y;
          const dz = pos[2] - camPos.z;
          return { node, pos, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) };
        })
        .filter(Boolean)
        .sort((a, b) => a!.dist - b!.dist)
        .slice(0, 60);

      labelCtx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
      labelCtx.textAlign = "center";
      labelCtx.textBaseline = "middle";

      for (const item of sorted) {
        if (!item) continue;
        const vec = new THREE.Vector3(item.pos[0], item.pos[1] + 2.8, item.pos[2]);
        vec.project(camera);

        const x = (vec.x * 0.5 + 0.5) * 2048;
        const y = (-vec.y * 0.5 + 0.5) * 2048;

        if (x < 20 || x > 2028 || y < 20 || y > 2028) continue;

        // Shadow
        labelCtx.shadowColor = "rgba(0,0,0,0.8)";
        labelCtx.shadowBlur = 6;
        labelCtx.shadowOffsetX = 0;
        labelCtx.shadowOffsetY = 2;
        labelCtx.fillStyle = "#ffffff";
        labelCtx.fillText(item.node.label, x, y);
        labelCtx.shadowBlur = 0;
      }

      labelTexture.needsUpdate = true;
    }

    // --- Raycaster & Click ---
    const raycaster = new THREE.Raycaster();
    raycaster.params = { ...raycaster.params, Points: { threshold: 0 } };
    let mouseDown = { x: 0, y: 0 };
    let isPointerDown = false;

    function getNDC(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    }

    function findHoveredNode(e: MouseEvent): number {
      const ndc = getNDC(e);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const intersects = raycaster.intersectObject(instancedMesh);
      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        return intersects[0].instanceId;
      }
      return -1;
    }

    const handlePointerDown = (e: PointerEvent) => {
      mouseDown = { x: e.clientX, y: e.clientY };
      isPointerDown = true;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const idx = findHoveredNode(e);
      if (idx >= 0) {
        const pos = positions.get(data.nodes[idx].id);
        if (pos) {
          hoverRing.position.set(pos[0], pos[1], pos[2]);
          hoverRing.lookAt(camera.position);
          hoverRing.visible = true;
          renderer.domElement.style.cursor = "pointer";
        }
      } else {
        hoverRing.visible = false;
        renderer.domElement.style.cursor = "grab";
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;

      const dx = e.clientX - mouseDown.x;
      const dy = e.clientY - mouseDown.y;
      // Only count as click if mouse barely moved
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      const idx = findHoveredNode(e);
      if (idx >= 0 && idx < data.nodes.length) {
        onNodeClick(data.nodes[idx].id);
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("dblclick", handleDblClick, { capture: true });

    // Animation loop
    let animId: number;
    let frameCount = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      frameCount++;
      if (frameCount % 8 === 0) {
        updateLabels();
      }

      // Billboard the hover ring
      if (hoverRing.visible) {
        hoverRing.quaternion.copy(camera.quaternion);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("dblclick", handleDblClick);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [data, filteredEdges, positions, onNodeClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
