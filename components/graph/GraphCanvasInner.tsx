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

  if (layout === "spherical" || n > 500) {
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
    // Force-directed (only for small datasets)
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      const r = 20 + Math.random() * 30;
      map.set(node.id, [
        r * Math.cos(angle),
        (Math.random() - 0.5) * 40,
        r * Math.sin(angle),
      ]);
    });

    const iters = Math.min(50, Math.max(10, Math.floor(2000 / n)));
    for (let iter = 0; iter < iters; iter++) {
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
    const nodeCount = data.nodes.length;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f0f);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 0, 120);

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(100, 100, 100);
    scene.add(pointLight);

    // Use instanced mesh for nodes (much faster)
    const sphereGeo = new THREE.SphereGeometry(0.8, 12, 12);
    const nodeMat = new THREE.MeshStandardMaterial({ color: 0x4f8cff });
    const instancedMesh = new THREE.InstancedMesh(sphereGeo, nodeMat, nodeCount);
    const dummy = new THREE.Object3D();
    const colorArray = new Float32Array(nodeCount * 3);
    const tempColor = new THREE.Color();

    data.nodes.forEach((node, i) => {
      const pos = positions.get(node.id);
      if (!pos) return;
      dummy.position.set(pos[0], pos[1], pos[2]);
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

    // Edge lines
    if (filteredEdges.length > 0) {
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
        scene.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x333344, transparent: true, opacity: 0.4 })));
      }
    }

    // Labels: only show for nearby nodes using a single canvas
    const labelCanvas = document.createElement("canvas");
    const labelCtx = labelCanvas.getContext("2d")!;
    labelCanvas.width = 1024;
    labelCanvas.height = 1024;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMat);
    labelSprite.scale.set(200, 200, 1);
    labelSprite.position.set(0, 0, 0);
    scene.add(labelSprite);

    function updateLabels() {
      labelCtx.clearRect(0, 0, 1024, 1024);
      const camPos = camera.position;

      // Find nodes closest to camera and draw their labels
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
        .slice(0, 50); // Only show 50 closest labels

      labelCtx.font = "bold 24px Arial";
      labelCtx.textAlign = "center";
      labelCtx.textBaseline = "middle";

      for (const item of sorted) {
        if (!item) continue;
        // Project 3D to 2D screen space
        const vec = new THREE.Vector3(item.pos[0], item.pos[1] + 2, item.pos[2]);
        vec.project(camera);

        const x = (vec.x * 0.5 + 0.5) * 1024;
        const y = (-vec.y * 0.5 + 0.5) * 1024;

        if (x < 0 || x > 1024 || y < 0 || y > 1024) continue;

        labelCtx.strokeStyle = "#000000";
        labelCtx.lineWidth = 3;
        labelCtx.strokeText(item.node.label, x, y);
        labelCtx.fillStyle = "#ffffff";
        labelCtx.fillText(item.node.label, x, y);
      }

      labelTexture.needsUpdate = true;
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
      const intersects = raycaster.intersectObject(instancedMesh);
      if (intersects.length > 0) {
        const idx = intersects[0].instanceId;
        if (idx !== undefined && idx < data.nodes.length) {
          onNodeClick(data.nodes[idx].id);
        }
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("click", handleClick);
    container.addEventListener("dblclick", handleDblClick, { capture: true });

    // Animation loop
    let animId: number;
    let frameCount = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Update labels every 10 frames
      frameCount++;
      if (frameCount % 10 === 0) {
        updateLabels();
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
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [data, filteredEdges, positions, onNodeClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
