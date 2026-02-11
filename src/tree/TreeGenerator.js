import { SeededRandom } from '../utils/SeededRandom.js';

// Tree generation parameters
const MAX_DEPTH = 9;
const BASE_THICKNESS = 28;

export class TreeGenerator {
  constructor() {
    this.rng = new SeededRandom();
    this.segments = [];
    this.maxDepth = MAX_DEPTH;
    this.baseThickness = BASE_THICKNESS;
  }

  generate(startX, startY, canvasHeight) {
    this.segments = [];
    this.canvasHeight = canvasHeight;
    this.baseLength = Math.min(canvasHeight * 0.22, 180);

    // Use +PI/2 to grow upward in Three.js coordinate system (Y+ is up)
    this.buildBranch(startX, startY, Math.PI / 2, 0, null);

    return this.segments;
  }

  buildBranch(x, y, angle, depth, parentIndex) {
    if (depth >= this.maxDepth) return undefined;

    // Calculate branch dimensions
    const lengthVariation = depth >= 6
      ? this.rng.range(0.8, 1.1)
      : this.rng.range(0.85, 1.15);
    const fullLength = this.baseLength * Math.pow(0.7, depth) * lengthVariation;
    const startThick = this.baseThickness * Math.pow(0.68, depth);
    const endThick = this.baseThickness * Math.pow(0.68, depth + 1);

    // Add subtle bend
    const bend = this.rng.range(-0.08, 0.08);
    const endAngle = angle + bend;

    // Calculate end position
    const endX = x + Math.cos(endAngle) * fullLength;
    const endY = y + Math.sin(endAngle) * fullLength;

    // Create segment
    const segIndex = this.segments.length;
    const segment = {
      index: segIndex,
      parent: parentIndex,
      x1: x, y1: y,
      x2: endX, y2: endY,
      angle: endAngle,
      depth: depth,
      thickness: startThick,
      endThickness: endThick,
      children: [],
      isCut: false
    };
    this.segments.push(segment);

    // Determine child branches based on depth
    const childAngles = this.getChildAngles(depth, endAngle);

    // Recursively build children
    for (const ca of childAngles) {
      const childIndex = this.buildBranch(endX, endY, ca, depth + 1, segIndex);
      if (childIndex !== undefined) {
        segment.children.push(childIndex);
      }
    }

    return segIndex;
  }

  getChildAngles(depth, endAngle) {
    const childAngles = [];

    if (depth === 0) {
      // Trunk: single continuation
      childAngles.push(endAngle + this.rng.range(-0.1, 0.1));
      this.rng.range(0.4, 1.6); // Consume random for consistency
    } else if (depth === 1) {
      // First branches: 2-3 children
      const n = this.rng.chance(0.6) ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const baseAngle = n === 2
          ? (i === 0 ? -0.7 : 0.7)
          : (i - 1) * 0.6;
        childAngles.push(endAngle + baseAngle + this.rng.range(-0.2, 0.2));
        this.rng.range(0.25, 1.75); // Consume for consistency
      }
    } else {
      // Higher depths: varying branch count
      const r1 = this.rng.random();
      const r2 = this.rng.random();

      let n;
      if (depth >= 7) {
        n = r1 < 0.75 ? 1 : (r2 < 0.6 ? 0 : 2);
      } else if (depth >= 5) {
        n = r1 < 0.55 ? 1 : 2;
      } else if (depth < 4) {
        n = r1 < 0.7 ? 2 : 3;
      } else {
        n = r1 < 0.5 ? 2 : (r2 < 0.7 ? 1 : 3);
      }

      const spread = 0.5 + depth * 0.05;

      for (let i = 0; i < n; i++) {
        let branchAngle;
        if (n === 1) {
          branchAngle = endAngle + this.rng.range(-spread * 0.5, spread * 0.5);
        } else if (n === 2) {
          branchAngle = endAngle + (i === 0 ? -1 : 1) * this.rng.range(spread * 0.4, spread);
        } else {
          branchAngle = endAngle + (i - 1) * this.rng.range(spread * 0.5, spread);
        }

        const pruneRand = this.rng.random();
        this.rng.range(0.35, 1.65); // Consume for consistency

        // Pruning probability based on depth
        const pruneThreshold = depth < 4 ? 0 : (depth >= 6 ? 0.2 : 0.12);
        if (pruneRand > pruneThreshold) {
          childAngles.push(branchAngle);
        }
      }
    }

    return childAngles;
  }

  setSeed(seed) {
    this.rng.setSeed(seed);
  }

  resetSeed() {
    this.rng.reset();
  }

  // Get all descendant indices of a segment
  getDescendants(segIndex) {
    const result = [];
    const stack = [segIndex];

    while (stack.length > 0) {
      const idx = stack.pop();
      result.push(idx);
      const seg = this.segments[idx];
      if (seg?.children) {
        stack.push(...seg.children);
      }
    }

    return result;
  }
}
