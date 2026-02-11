import { pickLeafColor } from '../utils/ColorUtils.js';
import { SeededRandom } from '../utils/SeededRandom.js';

export class LeafGenerator {
  constructor() {
    this.rng = new SeededRandom();
    this.leaves = [];
  }

  generate(segments) {
    this.leaves = [];

    for (const seg of segments) {
      if (seg.depth < 3) continue;

      const segLen = Math.sqrt(
        (seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2
      );
      if (segLen < 3) continue;

      // Calculate perpendicular and along-branch directions
      const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
      const perpX = Math.cos(angle + Math.PI / 2);
      const perpY = Math.sin(angle + Math.PI / 2);
      const alongX = Math.cos(angle);
      const alongY = Math.sin(angle);

      // Leaf count based on depth
      let count;
      if (seg.depth >= 7) count = 6 + Math.floor(Math.random() * 6);
      else if (seg.depth >= 5) count = 5 + Math.floor(Math.random() * 5);
      else if (seg.depth >= 4) count = 3 + Math.floor(Math.random() * 4);
      else count = 2 + Math.floor(Math.random() * 2);

      // Spread radius scales with depth
      const spreadRadius = seg.depth >= 6
        ? 22 + Math.random() * 18
        : seg.depth >= 4
          ? 16 + Math.random() * 14
          : 10 + Math.random() * 8;

      // Generate leaves along the branch
      for (let i = 0; i < count; i++) {
        const t = 0.15 + Math.random() * 0.8;
        const bx = seg.x1 + (seg.x2 - seg.x1) * t;
        const by = seg.y1 + (seg.y2 - seg.y1) * t;

        const perpOffset = (Math.random() - 0.5) * 2 * spreadRadius;
        const alongOffset = (Math.random() - 0.5) * spreadRadius * 0.6;
        const x = bx + perpX * perpOffset + alongX * alongOffset;
        const y = by + perpY * perpOffset + alongY * alongOffset;

        // Leaf size varies by depth
        const size = seg.depth >= 7
          ? 10 + Math.random() * 8
          : seg.depth >= 5
            ? 12 + Math.random() * 9
            : seg.depth >= 4
              ? 14 + Math.random() * 9
              : 16 + Math.random() * 7;

        this.leaves.push({
          x, y,
          bx, by,  // Branch attachment point
          segIndex: seg.index,
          t,
          angle: (Math.random() - 0.5) * Math.PI * 0.8,
          size,
          color: pickLeafColor(this.rng),
          depth: seg.depth,
          // Wind physics state
          ox: 0, oy: 0,
          vx: 0, vy: 0
        });
      }

      // Extra cluster at branch tips
      if (seg.children.length === 0 && seg.depth >= 5) {
        const tipCount = 4 + Math.floor(Math.random() * 5);

        for (let i = 0; i < tipCount; i++) {
          const tipSpread = 18 + Math.random() * 20;
          const randAngle = Math.random() * Math.PI * 2;
          const x = seg.x2 + Math.cos(randAngle) * tipSpread * (0.3 + Math.random() * 0.7);
          const y = seg.y2 + Math.sin(randAngle) * tipSpread * (0.3 + Math.random() * 0.7);

          const size = 10 + Math.random() * 10;

          this.leaves.push({
            x, y,
            bx: seg.x2, by: seg.y2,
            segIndex: seg.index,
            t: 0.95,
            angle: (Math.random() - 0.5) * Math.PI * 0.8,
            size,
            color: pickLeafColor(this.rng),
            depth: seg.depth,
            ox: 0, oy: 0,
            vx: 0, vy: 0
          });
        }
      }
    }

    return this.leaves;
  }
}
