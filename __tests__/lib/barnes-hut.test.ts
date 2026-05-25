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
    const positions: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [100, 0, 0],
      [101, 0, 0],
      [102, 0, 0],
    ];
    const tree = new BarnesHutTree(positions);
    const force = tree.getForce([50, 0, 0]);
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
    expect(elapsed).toBeLessThan(1000);
  });
});
