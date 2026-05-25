# Graph Page Redesign — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the 3D word graph visualization page with modern, minimal UI; make layout modes visually distinct; improve preprocessed data quality.

**Architecture:** Immersive fullscreen 3D graph with top capsule toolbar and floating card detail panel. Pure Three.js rendering with individual mesh nodes (per-node color/material) and weighted glowing edges. Two layout modes: force-directed (Barnes-Hut optimized) and spherical (Fibonacci distribution). Preprocessing script enhanced to assign node colors/sizes and edge weights.

**Tech Stack:** Next.js 14 (App Router), React 18, Three.js 0.170, Tailwind CSS 3, TypeScript

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page layout | Immersive + floating panel | Maximize 3D graph area, modern feel |
| Node style | Categorized colored nodes | Each EdgeType = distinct color, size by connection count |
| Edge style | Weighted glowing edges | Thickness by strength, same-color glow |
| Detail panel | Card-style floating panel | Dark solid card, clear sections, dismiss on click-outside |
| Toolbar | Compact capsule bar | All controls in one row, minimal footprint |
| Layout modes | Force-directed + Spherical | Remove random; force uses Barnes-Hut for O(n log n) |
| Data quality | Enhanced preprocessing | Node color/size by edge count, edge weight by type |

---

## File Structure

### Files to Create
- `lib/barnes-hut.ts` — Barnes-Hut quadtree for O(n log n) force-directed layout

### Files to Modify
- `scripts/preprocess.ts` — Add node color/size calculation, edge weight by type
- `components/graph/GraphCanvasInner.tsx` — Full rewrite: new visuals, 2 layouts, floating panel
- `components/graph/GraphCanvas.tsx` — Update LayoutType to remove "random"
- `components/graph/GraphFilters.tsx` — Update to compact capsule style for toolbar integration
- `components/graph/WordDetail.tsx` — Restyle as floating card panel
- `app/graph/page.tsx` — Restructure to immersive layout with top toolbar
- `lib/types.ts` — No changes needed (types already support color/size/weight)

### Files Unchanged
- `app/layout.tsx`, `app/page.tsx`, `app/wordbooks/page.tsx`, `app/settings/page.tsx`
- `components/layout/Header.tsx`
- `lib/similarity.ts`, `lib/root-affix.ts`, `lib/parser.ts`, `lib/llm.ts`

---

## Task 1: Enhanced Preprocessing Data

**Files:**
- Modify: `scripts/preprocess.ts`

**Goal:** Make nodes visually differentiated by assigning color (by primary edge type) and size (by edge count). Assign edge weights by type.

- [ ] **Step 1: Define edge type weights**

```typescript
const EDGE_WEIGHTS: Record<EdgeType, number> = {
  semantic: 3,    // Strongest — meaning-based connection
  root: 2.5,      // Etymological connection
  affix: 2,       // Morphological connection
  scene: 1.5,     // Contextual connection
  location: 1.5,  // Contextual connection
  similar: 1,     // Weakest — character similarity
};
```

- [ ] **Step 2: Calculate node color by primary edge type**

After building edges, for each node find its most frequent edge type. Assign color from `EDGE_COLORS[primaryType]`. Fallback to `#4f8cff` if no edges.

```typescript
function getNodeColor(nodeId: string, edges: GraphEdge[]): string {
  const counts = new Map<EdgeType, number>();
  for (const e of edges) {
    if (e.source === nodeId || e.target === nodeId) {
      counts.set(e.type, (counts.get(e.type) || 0) + 1);
    }
  }
  let maxType: EdgeType | null = null;
  let maxCount = 0;
  for (const [type, count] of counts) {
    if (count > maxCount) { maxCount = count; maxType = type; }
  }
  return maxType ? EDGE_COLORS[maxType] : "#4f8cff";
}
```

- [ ] **Step 3: Calculate node size by edge count**

```typescript
function getNodeSize(nodeId: string, edges: GraphEdge[]): number {
  const count = edges.filter(e => e.source === nodeId || e.target === nodeId).length;
  return Math.max(8, Math.min(20, 8 + count * 1.5));
}
```

- [ ] **Step 4: Apply weights and colors during graph construction**

Update the node/edge creation loop to use `getNodeColor`, `getNodeSize`, and `EDGE_WEIGHTS`.

- [ ] **Step 5: Re-run preprocessing**

The script processes all JSON files in `public/wordbooks/` automatically:

```bash
npx tsx scripts/preprocess.ts --no-llm
```

- [ ] **Step 6: Verify output JSON has varied node colors/sizes and edge weights**

```bash
node -e "const d=require('./public/graphs/CET4.json'); console.log('colors:', new Set(d.nodes.map(n=>n.color)).size); console.log('sizes:', new Set(d.nodes.map(n=>n.size)).size); console.log('weights:', new Set(d.edges.map(e=>e.weight)).size)"
```

Expected: colors > 1, sizes > 1, weights > 1

---

## Task 2: Barnes-Hut Force-Directed Layout

**Files:**
- Create: `lib/barnes-hut.ts`
- Modify: `components/graph/GraphCanvasInner.tsx` (layout function)

**Goal:** Replace O(n²) force simulation with Barnes-Hut O(n log n) algorithm so force-directed works for large datasets (4500+ nodes) without fallback.

- [ ] **Step 1: Implement Barnes-Hut quadtree**

```typescript
// lib/barnes-hut.ts
interface BHNode {
  x: number; y: number; z: number;
  mass: number;
  cx: number; cy: number; cz: number; // center of mass
  size: number;
  children: BHNode[] | null;
  isLeaf: boolean;
}

export class BarnesHutTree {
  root: BHNode;
  theta: number = 0.5;

  constructor(positions: [number, number, number][], bounds: number) {
    // Build octree from positions
  }

  update(positions: [number, number, number][]): void {
    // Rebuild tree
  }

  getForce(pos: [number, number, number]): [number, number, number] {
    // Calculate repulsive force using Barnes-Hut approximation
  }
}
```

- [ ] **Step 2: Integrate into force-directed layout**

Replace the all-pairs repulsion loop with Barnes-Hut tree queries:

```typescript
const tree = new BarnesHutTree(positions, 300);
for (let iter = 0; iter < iters; iter++) {
  tree.update(positions);
  // For each node, get force from tree (O(n log n) instead of O(n²))
  for (const node of nodes) {
    const force = tree.getForce(map.get(node.id)!);
    // Apply force
  }
  // Edge attraction (unchanged, O(edges))
}
```

- [ ] **Step 3: Test with CET4 data — should complete in < 2 seconds**

- [ ] **Step 4: Verify force-directed produces visible clustering**

---

## Task 3: Immersive Page Layout

**Files:**
- Modify: `app/graph/page.tsx`
- Modify: `components/graph/GraphCanvas.tsx`

**Goal:** Restructure the graph page to fullscreen immersive layout with top capsule toolbar.

- [ ] **Step 1: Update LayoutType**

```typescript
// components/graph/GraphCanvas.tsx
export type LayoutType = "force" | "spherical";
```

- [ ] **Step 2: Rewrite page layout**

Remove the 3-panel layout. Replace with:
- Full viewport height minus header
- Top capsule toolbar (absolute positioned, z-10)
- GraphCanvas fills entire area
- WordDetail as floating card (absolute positioned, z-20)

```tsx
// app/graph/page.tsx — new structure
<div className="relative h-[calc(100vh-56px)]">
  {/* Top toolbar */}
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
    <Toolbar layout={layout} onLayoutChange={setLayout} activeTypes={activeTypes} onToggleType={handleToggleType} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
  </div>

  {/* Fullscreen 3D graph */}
  <GraphCanvas data={data} onNodeClick={handleNodeClick} activeTypes={activeTypes} layout={layout} />

  {/* Floating detail card */}
  {selectedNode && (
    <div className="absolute top-20 right-4 z-20">
      <WordDetail nodeId={selectedNode} data={data} onClose={() => setSelectedNode(null)} onWordClick={handleNodeClick} />
    </div>
  )}
</div>
```

- [ ] **Step 3: Build and verify no type errors**

---

## Task 4: Compact Capsule Toolbar

**Files:**
- Modify: `app/graph/page.tsx` (inline toolbar component or new component)

**Goal:** Create the compact capsule toolbar with layout switcher, edge type color dots, and search input.

- [ ] **Step 1: Create Toolbar component**

Single row capsule with:
- Layout toggle pills (力导向 / 球形)
- Divider
- Color dots for each edge type (toggle on/off, show type name on hover)
- Divider
- Search input with magnifying glass icon

Style: `bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-2`

- [ ] **Step 2: Wire up props (layout, activeTypes, searchQuery)**

- [ ] **Step 3: Verify renders correctly in graph page**

---

## Task 5: Node Visual Overhaul

**Files:**
- Modify: `components/graph/GraphCanvasInner.tsx`

**Goal:** Implement categorized colored nodes with per-node materials and hover effects.

- [ ] **Step 1: Use node.color and node.size from data**

Instead of uniform `#4f8cff` and radius `0.8`, read from `node.color` and `node.size`:

```typescript
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
```

- [ ] **Step 2: Update hover effect — emissive glow + scale up 1.3x**

- [ ] **Step 3: Verify nodes have different colors based on primary edge type**

---

## Task 6: Weighted Glowing Edges

**Files:**
- Modify: `components/graph/GraphCanvasInner.tsx`

**Goal:** Render edges with per-type colors, thickness by weight, and glow effect.

- [ ] **Step 1: Group edges by type and render as separate LineSegments**

```typescript
const edgesByType = new Map<EdgeType, { points: number[]; weights: number[] }>();
for (const edge of filteredEdges) {
  // Group by type
}
for (const [type, { points, weights }] of edgesByType) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({
    color: EDGE_COLORS[type],
    transparent: true,
    opacity: 0.4,
    linewidth: 1, // Note: linewidth > 1 only works on some platforms
  });
  scene.add(new THREE.LineSegments(geo, mat));
}
```

- [ ] **Step 2: Add glow layer — duplicate edges with larger, more transparent version**

```typescript
// Glow layer (same geometry, wider, more transparent)
const glowMat = new THREE.LineBasicMaterial({
  color: EDGE_COLORS[type],
  transparent: true,
  opacity: 0.08,
});
scene.add(new THREE.LineSegments(geo.clone(), glowMat));
```

- [ ] **Step 3: Verify edges show different colors per type**

---

## Task 7: Floating Card Detail Panel

**Files:**
- Modify: `components/graph/WordDetail.tsx`

**Goal:** Restyle as a floating card panel with dark solid background, clear sections.

- [ ] **Step 1: Restyle container**

```tsx
<div className="w-72 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
```

- [ ] **Step 2: Add header with word, phonetic, and close button**

- [ ] **Step 3: Style related words as clickable cards with edge type color dots**

- [ ] **Step 4: Verify click-outside closes panel**

---

## Task 8: Update GraphFilters for Toolbar

**Files:**
- Modify: `components/graph/GraphFilters.tsx`

**Goal:** Restyle filters as compact color dots for toolbar integration.

- [ ] **Step 1: Replace pill buttons with color dot toggles**

Each edge type shows as a colored circle (16px). Active = full opacity, inactive = 30% opacity. Show type label on hover via title attribute.

- [ ] **Step 2: Verify toggling works correctly**

---

## Task 9: Integration and Polish

**Files:**
- All modified files

**Goal:** Wire everything together, test end-to-end.

- [ ] **Step 1: Build and fix any type errors**

```bash
npm run build
```

- [ ] **Step 2: Test with CET4 data — verify force-directed layout shows clustering**

- [ ] **Step 3: Test with CET4 data — verify spherical layout shows uniform distribution**

- [ ] **Step 4: Test node click — verify floating card appears with correct data**

- [ ] **Step 5: Test edge type filtering — verify edges show/hide correctly**

- [ ] **Step 6: Test search — verify filtering works**

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "feat: redesign graph page with immersive layout and enhanced visuals"
git push origin main
```
