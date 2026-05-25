"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EdgeType, GraphData, EDGE_COLORS } from "@/lib/types";
import { BarnesHutTree } from "@/lib/barnes-hut";

export type LayoutType = "force" | "spherical";

interface GraphCanvasProps {
  data: GraphData;
  onNodeClick: (nodeId: string) => void;
  activeTypes: EdgeType[];
  layout: LayoutType;
}

function computePositions(
  nodes: { id: string }[],
  edges: { source: string; target: string }[],
  layout: LayoutType
) {
  const map = new Map<string, [number, number, number]>();
  const n = nodes.length;
  if (n === 0) return map;

  if (layout === "spherical") {
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
  } else {
    // Force-directed with Barnes-Hut
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

      // Barnes-Hut repulsion (O(n log n))
      const positions = nodes.map((n) => map.get(n.id)!);
      const tree = new BarnesHutTree(positions);
      nodes.forEach((node, i) => {
        const force = tree.getForce(positions[i]);
        const f = forces.get(node.id)!;
        f[0] += force[0];
        f[1] += force[1];
        f[2] += force[2];
      });

      // Edge attraction
      for (const edge of edges) {
        const a = map.get(edge.source);
        const b = map.get(edge.target);
        if (!a || !b) continue;
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          dz = b[2] - a[2];
        const fx = dx * 0.012,
          fy = dy * 0.012,
          fz = dz * 0.012;
        const fa = forces.get(edge.source)!;
        const fb = forces.get(edge.target)!;
        fa[0] += fx;
        fa[1] += fy;
        fa[2] += fz;
        fb[0] -= fx;
        fb[1] -= fy;
        fb[2] -= fz;
      }

      // Apply forces
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

export default function GraphCanvasInner({
  data,
  onNodeClick,
  activeTypes,
  layout,
}: GraphCanvasProps) {
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f0f);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 20, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 10;
    controls.maxDistance = 500;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(100, 100, 100);
    scene.add(pointLight);

    // Node meshes
    const nodeGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(1, 16, 16);

    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const mat = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: 0.15,
        metalness: 0.2,
        roughness: 0.7,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      const scale = (node.size || 10) / 10;
      mesh.scale.setScalar(scale);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.userData = { id: node.id, label: node.label };
      nodeGroup.add(mesh);
    }
    scene.add(nodeGroup);

    // Edge lines grouped by type
    const edgesByType = new Map<EdgeType, { points: number[] }>();
    for (const edge of filteredEdges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) continue;
      if (!edgesByType.has(edge.type))
        edgesByType.set(edge.type, { points: [] });
      edgesByType.get(edge.type)!.points.push(
        a[0], a[1], a[2],
        b[0], b[1], b[2]
      );
    }

    for (const [type, { points }] of edgesByType) {
      if (points.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

      // Main edge
      const mat = new THREE.LineBasicMaterial({
        color: EDGE_COLORS[type],
        transparent: true,
        opacity: 0.4,
      });
      scene.add(new THREE.LineSegments(geo, mat));

      // Glow layer
      const glowMat = new THREE.LineBasicMaterial({
        color: EDGE_COLORS[type],
        transparent: true,
        opacity: 0.08,
      });
      scene.add(new THREE.LineSegments(geo.clone(), glowMat));
    }

    // Text labels using sprites
    const MAX_LABELS = 80;
    const labelGroup = new THREE.Group();
    const labelMap = new Map<string, THREE.Sprite>();

    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = 256;
      canvas.height = 64;
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
      ctx.strokeText(node.label, 128, 32);
      ctx.fillText(node.label, 128, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(pos[0], pos[1] + 2, pos[2]);
      sprite.scale.set(8, 2, 1);
      sprite.visible = false;
      labelGroup.add(sprite);
      labelMap.set(node.id, sprite);
    }
    scene.add(labelGroup);

    function updateLabelVisibility() {
      const camPos = camera.position;
      const sorted = data.nodes
        .map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const dx = pos[0] - camPos.x;
          const dy = pos[1] - camPos.y;
          const dz = pos[2] - camPos.z;
          return { id: node.id, dist: dx * dx + dy * dy + dz * dz };
        })
        .filter(Boolean)
        .sort((a, b) => a!.dist - b!.dist);

      for (const [, sprite] of labelMap) sprite.visible = false;
      for (let i = 0; i < Math.min(MAX_LABELS, sorted.length); i++) {
        const sprite = labelMap.get(sorted[i]!.id);
        if (sprite) sprite.visible = true;
      }
    }

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDown = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      mouseDown = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: MouseEvent) => {
      const dx = e.clientX - mouseDown.x;
      const dy = e.clientY - mouseDown.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeGroup.children);
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const id = mesh.userData.id;
        if (id) onNodeClick(id);
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Hover effect
    let hoveredMesh: THREE.Mesh | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeGroup.children);

      if (hoveredMesh) {
        (hoveredMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        hoveredMesh.scale.setScalar((hoveredMesh.userData as any)._baseScale || 1);
        hoveredMesh = null;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5;
        const baseScale = (mesh.userData as any)._baseScale || mesh.scale.x;
        (mesh.userData as any)._baseScale = baseScale;
        mesh.scale.setScalar(baseScale * 1.3);
        container.style.cursor = "pointer";
        hoveredMesh = mesh;
      } else {
        container.style.cursor = "default";
      }
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("click", handleClick);
    container.addEventListener("dblclick", handleDblClick, { capture: true });
    container.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    let animId: number;
    let frameCount = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      frameCount++;
      if (frameCount % 10 === 0) {
        updateLabelVisibility();
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
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("dblclick", handleDblClick);
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [data, filteredEdges, positions, onNodeClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
