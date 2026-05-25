# Graph Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the 3D word graph page with immersive layout, categorized colored nodes, weighted glowing edges, and optimized force-directed layout.

**Architecture:** Fullscreen 3D graph with floating top toolbar and card-style detail panel. Pure Three.js rendering with individual mesh nodes per word (color/size from preprocessed data). Two layout modes: force-directed (Barnes-Hut O(n log n)) and spherical (Fibonacci). Preprocessing assigns node color by primary edge type, size by edge count, and edge weight by type.

**Tech Stack:** Next.js 14 (App Router), React 18, Three.js 0.170, Tailwind CSS 3, TypeScript, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/preprocess.ts` | Modify | Add node color/size calculation, edge weight by type |
| `lib/barnes-hut.ts` | Create | Barnes-Hut octree for O(n log n) force-directed layout |
| `__tests__/lib/barnes-hut.test.ts` | Create | Unit tests for Barnes-Hut |
| `components/graph/GraphCanvas.tsx` | Modify | Update LayoutType: remove "random" |
| `components/graph/GraphCanvasInner.tsx` | Rewrite | New visuals, 2 layouts, weighted edges |
| `components/graph/GraphFilters.tsx` | Rewrite | Compact color dot toggles |
| `components/graph/WordDetail.tsx` | Rewrite | Floating card panel style |
| `app/graph/page.tsx` | Rewrite | Immersive layout with top toolbar |

---

### Task 1: Enhanced Preprocessing Data

**Files:**
- Modify: `scripts/preprocess.ts`
- Modify: `public/graphs/*.json` (regenerated)

**Context:** The preprocess script at `scripts/preprocess.ts` reads word lists from `public/wordbooks/*.json` and generates graph JSON to `public/graphs/*.json`. Currently all nodes get `size: 10` and `color: "#4f8cff"`, all edges get `weight: 1`. The `EDGE_COLORS` map is imported from `lib/types.ts` and maps each `EdgeType` to a hex color.

- [ ] **Step 1: Add EDGE_WEIGHTS constant and helper functions**

Add after the existing `COLORS` constant (line 41) in `scripts/preprocess.ts`:

```typescript
const EDGE_WEIGHTS: Record<string, number> = {
  semantic: 3,
  root: 2.5,
  affix: 2,
  scene: 1.5,
  location: 1.5,
  similar: 1,
};

function getNodeColor(nodeId: string, edges: GraphEdge[]): string {
  const counts = new Map<string, number>();
  for (const e of edges) {
    if (e.source === nodeId || e.target === nodeId) {
      counts.set(e.type, (counts.get(e.type) || 0) + 1);
    }
  }
  let maxType: string | null = null;
  let maxCount = 0;
  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  }
  return maxType ? EDGE_COLORS[maxType as EdgeType] : "#4f8cff";
}

function getNodeSize(nodeId: string, edges: GraphEdge[]): number {
  const count = edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  ).length;
  return Math.max(8, Math.min(20, 8 + count * 1.5));
}
```

- [ ] **Step 2: Update addEdge to use EDGE_WEIGHTS**

Change the `addEdge` function (line 64-83) to use `EDGE_WEIGHTS[type]` instead of hardcoded `weight: 1`:

```typescript
function addEdge(
  source: number,
  target: number,
  type: string,
  color: string
) {
  const [s, t] = source < target ? [source, target] : [target, source];
  const key = `${s}-${t}-${type}`;
  if (edgeSet.has(key)) return;
  edgeSet.add(key);
  edges.push({
    id: `${edges.length}`,
    source: String(s),
    target: String(t),
    type: type as any,
    weight: EDGE_WEIGHTS[type] || 1,
    color,
    size: 1,
  });
}
```

- [ ] **Step 3: Apply node color/size after edge construction**

After the LLM edges section (before `return { name, nodes, edges };` at line 151), add:

```typescript
// Assign node colors and sizes based on edges
for (const node of nodes) {
  node.color = getNodeColor(node.id, edges);
  node.size = getNodeSize(node.id, edges);
}
```

- [ ] **Step 4: Run preprocessing**

```bash
npx tsx scripts/preprocess.ts --no-llm
```

Expected: Processes CET4, CET6, TOEFL, GRE successfully.

- [ ] **Step 5: Verify output has varied data**

```bash
node -e "const d=require('./public/graphs/CET4.json'); console.log('colors:', new Set(d.nodes.map(n=>n.color)).size); console.log('sizes:', new Set(d.nodes.map(n=>n.size)).size); console.log('weights:', new Set(d.edges.map(e=>e.weight)).size)"
```

Expected: colors >= 2, sizes >= 2, weights >= 2.

- [ ] **Step 6: Commit**

```bash
git add scripts/preprocess.ts public/graphs/
git commit -m "feat: enhance preprocessing with node colors/sizes and edge weights"
```

---

### Task 2: Barnes-Hut Force-Directed Layout

**Files:**
- Create: `lib/barnes-hut.ts`
- Create: `__tests__/lib/barnes-hut.test.ts`

**Context:** The current force-directed layout in `GraphCanvasInner.tsx` uses O(n²) all-pairs repulsion. For CET4 (4543 nodes) this is ~10M calculations per iteration. Barnes-Hut uses an octree to approximate distant forces, reducing to O(n log n).

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/barnes-hut.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { BarnesHutTree } from "@/lib/barnes-hut";

describe("BarnesHutTree", () => {
  it("should construct from positions", () => {
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0],
      [0, 0, 10],
    ];
    const tree = new BarnesHutTree(positions);
    expect(tree).toBeDefined();
  });

  it("should return a force vector for a position", () => {
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0],
    ];
    const tree = new BarnesHutTree(positions);
    const force = tree.getForce([5, 5, 5]);
    expect(force).toHaveLength(3);
    expect(force[0]).not.toBeNaN();
    expect(force[1]).not.toBeNaN();
    expect(force[2]).not.toBeNaN();
  });

  it("should produce repulsive forces away from clusters", () => {
    // Two clusters: one at origin, one at (100,0,0)
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [100, 0, 0],
      [101, 0, 0],
      [102, 0, 0],
    ];
    const tree = new BarnesHutTree(positions);
    // Point between clusters should get pushed away from both
    const force = tree.getForce([50, 0, 0]);
    // Force magnitude should be non-trivial
    const mag = Math.sqrt(force[0] ** 2 + force[1] ** 2 + force[2] ** 2);
    expect(mag).toBeGreaterThan(0);
  });

  it("should handle many positions quickly", () => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 5000; i++) {
      positions.push([
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
      ]);
    }
    const start = performance.now();
    const tree = new BarnesHutTree(positions);
    for (let i = 0; i < 100; i++) {
      tree.getForce(positions[i]);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000); // Should be fast
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/lib/barnes-hut.test.ts
```

Expected: FAIL — module `@/lib/barnes-hut` not found.

- [ ] **Step 3: Implement Barnes-Hut octree**

Create `lib/barnes-hut.ts`:

```typescript
interface BHNode {
  cx: number;
  cy: number;
  cz: number;
  mass: number;
  halfSize: number;
  children: BHNode[] | null;
  particleIndex: number; // -1 if internal node
}

export class BarnesHutTree {
  private root: BHNode | null = null;
  private positions: [number, number, number][] = [];
  private theta = 0.5;
  private g = 500; // gravitational constant

  constructor(positions: [number, number, number][]) {
    this.positions = positions;
    this.build();
  }

  private build(): void {
    if (this.positions.length === 0) {
      this.root = null;
      return;
    }

    // Find bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of this.positions) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const halfSize =
      Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 1;

    this.root = {
      cx, cy, cz,
      mass: 0,
      halfSize,
      children: null,
      particleIndex: -1,
    };

    // Insert all particles
    for (let i = 0; i < this.positions.length; i++) {
      this.insert(this.root, i, this.positions[i], halfSize);
    }
  }

  private insert(
    node: BHNode,
    index: number,
    pos: [number, number, number],
    halfSize: number
  ): void {
    if (node.mass === 0) {
      // Empty node — place particle here
      node.cx = pos[0];
      node.cy = pos[1];
      node.cz = pos[2];
      node.mass = 1;
      node.particleIndex = index;
      node.halfSize = halfSize;
      return;
    }

    if (node.children === null && node.particleIndex >= 0) {
      // Leaf node with a particle — subdivide
      const oldIndex = node.particleIndex;
      const oldPos = this.positions[oldIndex];
      node.particleIndex = -1;
      node.children = this.createChildren(node, halfSize);

      // Re-insert old particle
      const oldChild = this.findChild(node, oldPos);
      this.insert(node.children[oldChild], oldIndex, oldPos, halfSize / 2);
    }

    if (node.children === null) return;

    // Insert new particle into appropriate child
    const childIdx = this.findChild(node, pos);
    this.insert(node.children[childIdx], index, pos, halfSize / 2);

    // Update center of mass
    const totalMass = node.mass + 1;
    node.cx = (node.cx * node.mass + pos[0]) / totalMass;
    node.cy = (node.cy * node.mass + pos[1]) / totalMass;
    node.cz = (node.cz * node.mass + pos[2]) / totalMass;
    node.mass = totalMass;
  }

  private createChildren(node: BHNode, halfSize: number): BHNode[] {
    const children: BHNode[] = [];
    const hs = halfSize / 2;
    for (let dx = -1; dx <= 1; dx += 2) {
      for (let dy = -1; dy <= 1; dy += 2) {
        for (let dz = -1; dz <= 1; dz += 2) {
          children.push({
            cx: node.cx + dx * hs,
            cy: node.cy + dy * hs,
            cz: node.cz + dz * hs,
            mass: 0,
            halfSize: hs,
            children: null,
            particleIndex: -1,
          });
        }
      }
    }
    return children;
  }

  private findChild(
    node: BHNode,
    pos: [number, number, number]
  ): number {
    let idx = 0;
    if (pos[0] > node.cx) idx |= 1;
    if (pos[1] > node.cy) idx |= 2;
    if (pos[2] > node.cz) idx |= 4;
    return idx;
  }

  getForce(pos: [number, number, number]): [number, number, number] {
    const force: [number, number, number] = [0, 0, 0];
    if (this.root) {
      this.computeForce(this.root, pos, force);
    }
    return force;
  }

  private computeForce(
    node: BHNode,
    pos: [number, number, number],
    force: [number, number, number]
  ): void {
    if (node.mass === 0) return;

    const dx = pos[0] - node.cx;
    const dy = pos[1] - node.cy;
    const dz = pos[2] - node.cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq);

    if (dist < 0.1) return; // Avoid singularity

    // Check if node is far enough to treat as single body
    const nodeSize = node.halfSize * 2;
    if (
      node.children === null ||
      nodeSize / dist < this.theta
    ) {
      // Treat as single body
      const f = (this.g * node.mass) / (distSq + 10); // +10 softening
      force[0] += (dx / dist) * f;
      force[1] += (dy / dist) * f;
      force[2] += (dz / dist) * f;
    } else {
      // Recurse into children
      for (const child of node.children) {
        this.computeForce(child, pos, force);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/lib/barnes-hut.test.ts
```

Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/barnes-hut.ts __tests__/lib/barnes-hut.test.ts
git commit -m "feat: add Barnes-Hut octree for O(n log n) force layout"
```

---

### Task 3: Layout Type Update

**Files:**
- Modify: `components/graph/GraphCanvas.tsx`

**Context:** Currently exports `LayoutType = "force" | "spherical" | "random"`. Need to remove "random".

- [ ] **Step 1: Update LayoutType**

In `components/graph/GraphCanvas.tsx`, change line 6:

```typescript
export type LayoutType = "force" | "spherical";
```

- [ ] **Step 2: Update GraphCanvasProps if needed**

The `interface GraphCanvasProps` already uses `LayoutType` — no change needed there.

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | head -20
```

Expected: May have type errors in `app/graph/page.tsx` that references "random" — those will be fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add components/graph/GraphCanvas.tsx
git commit -m "refactor: remove random layout type"
```

---

### Task 4: Immersive Page Layout + Toolbar

**Files:**
- Rewrite: `app/graph/page.tsx`

**Context:** Currently uses a 3-panel layout (left sidebar, center graph, right detail panel). Need to replace with fullscreen graph + floating toolbar + floating detail card. The page uses `useSearchParams()` inside a `Suspense` boundary.

- [ ] **Step 1: Rewrite GraphContent component**

Replace the entire `GraphContent` function in `app/graph/page.tsx`:

```tsx
"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GraphCanvas, LayoutType } from "@/components/graph/GraphCanvas";
import { GraphFilters } from "@/components/graph/GraphFilters";
import { WordDetail } from "@/components/graph/WordDetail";
import { GraphData, EdgeType, EDGE_TYPE_LABELS } from "@/lib/types";

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <p className="text-gray-500">加载中...</p>
        </div>
      }
    >
      <GraphContent />
    </Suspense>
  );
}

function GraphContent() {
  const searchParams = useSearchParams();
  const wordbook = searchParams.get("wordbook");

  const [fullData, setFullData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<EdgeType[]>([
    "semantic", "location", "scene", "similar", "root", "affix",
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [layout, setLayout] = useState<LayoutType>("force");

  useEffect(() => {
    if (wordbook) {
      fetch(`/graphs/${wordbook}.json`)
        .then((res) => res.json())
        .then((graph) => setFullData(graph))
        .catch(() => setFullData(null));
    }
  }, [wordbook]);

  const data: GraphData | null = fullData
    ? {
        nodes: fullData.nodes,
        edges: fullData.edges.filter((e) => activeTypes.includes(e.type)),
      }
    : null;

  const handleToggleType = useCallback((type: EdgeType) => {
    setActiveTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId);
  }, []);

  if (!wordbook) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">请先选择一本单词书</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-56px)] overflow-hidden">
      {/* Top toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
          {/* Layout switcher */}
          <div className="flex gap-1 bg-[#111] rounded-full p-0.5">
            {(["force", "spherical"] as LayoutType[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setLayout(opt)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  layout === opt
                    ? "bg-[#4f8cff15] border border-[#4f8cff30] text-[#4f8cff]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {opt === "force" ? "力导向" : "球形"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[#2a2a2a]" />

          {/* Edge type dots */}
          <GraphFilters activeTypes={activeTypes} onToggle={handleToggleType} />

          <div className="w-px h-5 bg-[#2a2a2a]" />

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#2a2a2a] border border-[#333] rounded-full px-3 py-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#666"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索单词..."
              className="bg-transparent text-sm text-white placeholder:text-gray-600 outline-none w-32"
            />
          </div>
        </div>
      </div>

      {/* Fullscreen 3D graph */}
      <GraphCanvas
        data={data}
        onNodeClick={handleNodeClick}
        activeTypes={activeTypes}
        layout={layout}
      />

      {/* Floating detail card */}
      {selectedNode && (
        <div className="absolute top-20 right-4 z-20">
          <WordDetail
            nodeId={selectedNode}
            data={data}
            onClose={() => setSelectedNode(null)}
            onWordClick={handleNodeClick}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify type errors**

```bash
npm run build 2>&1 | grep "Error:" | head -10
```

Expected: Possible errors from removed "random" references or missing props. Fix as needed.

- [ ] **Step 3: Commit**

```bash
git add app/graph/page.tsx
git commit -m "feat: immersive graph page layout with floating toolbar"
```

---

### Task 5: Compact Color Dot Filters

**Files:**
- Rewrite: `components/graph/GraphFilters.tsx`

**Context:** Currently uses pill-shaped buttons with colored backgrounds. Need to replace with compact colored dots (16px circles) that toggle on click and show type name on hover.

- [ ] **Step 1: Rewrite GraphFilters**

Replace `components/graph/GraphFilters.tsx`:

```tsx
"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, EdgeType } from "@/lib/types";

interface GraphFiltersProps {
  activeTypes: EdgeType[];
  onToggle: (type: EdgeType) => void;
}

const allTypes: EdgeType[] = [
  "semantic", "location", "scene", "similar", "root", "affix",
];

export function GraphFilters({ activeTypes, onToggle }: GraphFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      {allTypes.map((type) => {
        const isActive = activeTypes.includes(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            title={EDGE_TYPE_LABELS[type]}
            className="w-4 h-4 rounded-full transition-all hover:scale-125"
            style={{
              backgroundColor: EDGE_COLORS[type],
              opacity: isActive ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | grep "Error:" | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/graph/GraphFilters.tsx
git commit -m "feat: compact color dot filters for toolbar"
```

---

### Task 6: Floating Card Detail Panel

**Files:**
- Rewrite: `components/graph/WordDetail.tsx`

**Context:** Currently renders as a full-height flex column. Need to restyle as a compact floating card with rounded corners, shadow, and dark solid background. Click-outside-to-close will be handled by the parent page (not this component).

- [ ] **Step 1: Rewrite WordDetail**

Replace `components/graph/WordDetail.tsx`:

```tsx
"use client";

import { EDGE_COLORS, EDGE_TYPE_LABELS, GraphData, EdgeType } from "@/lib/types";

interface WordDetailProps {
  nodeId: string;
  data: GraphData;
  onClose: () => void;
  onWordClick: (nodeId: string) => void;
}

export function WordDetail({
  nodeId,
  data,
  onClose,
  onWordClick,
}: WordDetailProps) {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const relatedEdges = data.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  );

  const relatedWords = relatedEdges.map((edge) => {
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    const otherNode = data.nodes.find((n) => n.id === otherId);
    return {
      id: otherId,
      word: otherNode?.label || "",
      type: edge.type as EdgeType,
    };
  });

  return (
    <div className="w-72 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div>
          <h2 className="text-lg font-semibold text-white">{node.label}</h2>
          {node.phonetic && (
            <p className="text-gray-500 text-xs mt-0.5">{node.phonetic}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#3a3a3a] transition-colors text-xs"
        >
          ×
        </button>
      </div>

      {/* Definition */}
      {node.definition && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-300 leading-relaxed">
            {node.definition}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-[#2a2a2a] mx-4" />

      {/* Related words */}
      <div className="p-4 pt-3">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
          关联单词
        </p>
        <div className="space-y-1 max-h-60 overflow-auto">
          {relatedWords.length === 0 ? (
            <p className="text-xs text-gray-600">暂无关联单词</p>
          ) : (
            relatedWords.map((word, i) => (
              <button
                key={i}
                onClick={() => onWordClick(word.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors text-left"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: EDGE_COLORS[word.type] }}
                />
                <span className="text-sm text-gray-300 flex-1">
                  {word.word}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: EDGE_COLORS[word.type] }}
                >
                  {EDGE_TYPE_LABELS[word.type]}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | grep "Error:" | head -5
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/graph/WordDetail.tsx
git commit -m "feat: floating card style for word detail panel"
```

---

### Task 7: Graph Canvas Visual Overhaul

**Files:**
- Rewrite: `components/graph/GraphCanvasInner.tsx`

**Context:** This is the core 3D renderer. Currently uses individual meshes with uniform color. Need to:
1. Use node.color and node.size from data
2. Use Barnes-Hut for force-directed layout
3. Render edges grouped by type with glow effect
4. Keep hover effect (emissive + scale)
5. Keep click detection via raycasting
6. Keep label system (closest 80 sprites visible)

- [ ] **Step 1: Write the full rewrite**

Replace `components/graph/GraphCanvasInner.tsx` with the following. Key changes from current version:
- Import `BarnesHutTree` from `@/lib/barnes-hut`
- Import `EDGE_COLORS` from `@/lib/types`
- `computePositions`: use Barnes-Hut for force-directed, keep Fibonacci for spherical
- Node creation: use `node.color` and `node.size` for per-node material/scale
- Edge rendering: group by type, render with per-type color + glow layer
- Hover: emissive glow + 1.3x scale (unchanged)
- Click: raycasting on nodeGroup.children (unchanged)

```tsx
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
    const edgesByType = new Map<
      EdgeType,
      { points: number[] }
    >();
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
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3)
      );

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
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });
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
          return {
            id: node.id,
            dist: dx * dx + dy * dy + dz * dz,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.dist - b!.dist);

      for (const [, sprite] of labelMap) sprite.visible = false;
      for (
        let i = 0;
        i < Math.min(MAX_LABELS, sorted.length);
        i++
      ) {
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
      const intersects = raycaster.intersectObjects(
        nodeGroup.children
      );
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
      const intersects = raycaster.intersectObjects(
        nodeGroup.children
      );

      if (hoveredMesh) {
        (
          hoveredMesh.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = 0.15;
        hoveredMesh.scale.setScalar(
          ((hoveredMesh.userData as any)._baseScale || 1)
        );
        hoveredMesh = null;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5;
        const baseScale =
          (mesh.userData as any)._baseScale ||
          mesh.scale.x;
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
    container.addEventListener("dblclick", handleDblClick, {
      capture: true,
    });
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
      camera.aspect =
        container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        container.clientWidth,
        container.clientHeight
      );
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
```

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | grep "Error:" | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/graph/GraphCanvasInner.tsx
git commit -m "feat: visual overhaul with categorized nodes, weighted edges, Barnes-Hut layout"
```

---

### Task 8: Build and Integration Test

**Files:**
- All modified files

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: All tests pass (including new Barnes-Hut tests).

- [ ] **Step 3: Run dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:3000/wordbooks`, click CET4, verify:
- Graph renders with colored nodes (different colors by edge type)
- Nodes have different sizes
- Edges show different colors per type
- Force-directed layout shows clustering
- Spherical layout shows uniform distribution
- Clicking a node shows floating card detail
- Closing the card works
- Edge type dots toggle correctly
- Search input works

- [ ] **Step 4: Commit all graph data files**

```bash
git add public/graphs/
git commit -m "chore: regenerate graph data with enhanced preprocessing"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```
