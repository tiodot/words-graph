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

function computePositions(nodes: { id: string }[], edges: { source: string; target: string }[], layout: LayoutType) {
  const map = new Map<string, [number, number, number]>();
  const n = nodes.length;
  if (n === 0) return map;

  if (layout === "spherical") {
    const radius = Math.max(30, Math.sqrt(n) * 5);
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
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
      ]);
    });
  } else {
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      const r = 20 + Math.random() * 30;
      map.set(node.id, [
        r * Math.cos(angle),
        (Math.random() - 0.5) * 40,
        r * Math.sin(angle),
      ]);
    });

    for (let iter = 0; iter < 80; iter++) {
      const forces = new Map<string, [number, number, number]>();
      nodes.forEach((n) => forces.set(n.id, [0, 0, 0]));

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = map.get(nodes[i].id)!;
          const b = map.get(nodes[j].id)!;
          const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1);
          const f = 500 / (dist * dist);
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
        const fx = dx * 0.01, fy = dy * 0.01, fz = dz * 0.01;
        const fa = forces.get(edge.source)!;
        const fb = forces.get(edge.target)!;
        fa[0] += fx; fa[1] += fy; fa[2] += fz;
        fb[0] -= fx; fb[1] -= fy; fb[2] -= fz;
      }

      nodes.forEach((n) => {
        const pos = map.get(n.id)!;
        const f = forces.get(n.id)!;
        pos[0] = Math.max(-200, Math.min(200, pos[0] + f[0] * 0.5));
        pos[1] = Math.max(-200, Math.min(200, pos[1] + f[1] * 0.5));
        pos[2] = Math.max(-200, Math.min(200, pos[2] + f[2] * 0.5));
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

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f0f);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 0, 80);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(100, 100, 100);
    scene.add(pointLight);

    // Node meshes
    const nodeGroup = new THREE.Group();
    const nodeMap = new Map<THREE.Mesh, string>();
    const sphereGeo = new THREE.SphereGeometry(0.8, 16, 16);

    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const mat = new THREE.MeshStandardMaterial({ color: node.color });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.userData = { id: node.id, label: node.label };
      nodeGroup.add(mesh);
      nodeMap.set(mesh, node.id);
    }
    scene.add(nodeGroup);

    // Edge lines
    const edgePoints: number[] = [];
    for (const edge of filteredEdges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (a && b) {
        edgePoints.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    if (edgePoints.length > 0) {
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePoints, 3));
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x333344, transparent: true, opacity: 0.6 });
      scene.add(new THREE.LineSegments(edgeGeo, edgeMat));
    }

    // Text labels using sprites
    const labelGroup = new THREE.Group();
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
      labelGroup.add(sprite);
    }
    scene.add(labelGroup);

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDown = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      mouseDown = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: MouseEvent) => {
      const dx = e.clientX - mouseDown.x;
      const dy = e.clientY - mouseDown.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return; // Was a drag

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
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("click", handleClick);
    container.addEventListener("dblclick", handleDblClick, { capture: true });

    // Hover effect
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeGroup.children);

      nodeGroup.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        mesh.scale.set(1, 1, 1);
      });

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(
          (mesh.material as THREE.MeshStandardMaterial).color.getHex()
        );
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
        mesh.scale.set(1.3, 1.3, 1.3);
        container.style.cursor = "pointer";
      } else {
        container.style.cursor = "default";
      }
    };
    container.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
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
