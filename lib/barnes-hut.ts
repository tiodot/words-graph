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
  private g = 500;

  constructor(positions: [number, number, number][]) {
    this.positions = positions;
    this.build();
  }

  private build(): void {
    if (this.positions.length === 0) {
      this.root = null;
      return;
    }

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
    const halfSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 + 1;

    this.root = { cx, cy, cz, mass: 0, halfSize, children: null, particleIndex: -1 };

    for (let i = 0; i < this.positions.length; i++) {
      this.insert(this.root, i, this.positions[i], halfSize);
    }
  }

  private insert(node: BHNode, index: number, pos: [number, number, number], halfSize: number, depth = 0): void {
    if (node.mass === 0) {
      node.cx = pos[0];
      node.cy = pos[1];
      node.cz = pos[2];
      node.mass = 1;
      node.particleIndex = index;
      node.halfSize = halfSize;
      return;
    }

    // Prevent infinite recursion when positions overlap
    if (depth > 20) {
      const totalMass = node.mass + 1;
      node.cx = (node.cx * node.mass + pos[0]) / totalMass;
      node.cy = (node.cy * node.mass + pos[1]) / totalMass;
      node.cz = (node.cz * node.mass + pos[2]) / totalMass;
      node.mass = totalMass;
      return;
    }

    if (node.children === null && node.particleIndex >= 0) {
      const oldIndex = node.particleIndex;
      const oldPos = this.positions[oldIndex];
      node.particleIndex = -1;
      node.children = this.createChildren(node, halfSize);
      const oldChild = this.findChild(node, oldPos);
      this.insert(node.children[oldChild], oldIndex, oldPos, halfSize / 2, depth + 1);
    }

    if (node.children === null) return;

    const childIdx = this.findChild(node, pos);
    this.insert(node.children[childIdx], index, pos, halfSize / 2, depth + 1);

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

  private findChild(node: BHNode, pos: [number, number, number]): number {
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

  private computeForce(node: BHNode, pos: [number, number, number], force: [number, number, number]): void {
    if (node.mass === 0) return;

    const dx = pos[0] - node.cx;
    const dy = pos[1] - node.cy;
    const dz = pos[2] - node.cz;
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq);

    if (dist < 0.1) return;

    if (node.children === null || (node.halfSize * 2) / dist < this.theta) {
      const f = (this.g * node.mass) / (distSq + 10);
      force[0] += (dx / dist) * f;
      force[1] += (dy / dist) * f;
      force[2] += (dz / dist) * f;
    } else {
      for (const child of node.children) {
        this.computeForce(child, pos, force);
      }
    }
  }
}
