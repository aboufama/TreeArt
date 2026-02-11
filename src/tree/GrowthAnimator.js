const DEPTH_DELAY = 280;       // ms between depth levels starting to grow
const SEG_GROW_DURATION = 350; // ms for one segment to fully extend
const MAX_DEPTH = 9;
const LEAF_DURATION = 2500;    // ms for leaf pop-in to complete

export class GrowthAnimator {
  constructor() {
    this.startTime = 0;
    this.leafGrowStart = 0;
    this.branchGrowDuration = MAX_DEPTH * DEPTH_DELAY + SEG_GROW_DURATION;
    this.phase = 'idle'; // 'branches', 'leaves', 'idle'
  }

  start() {
    this.startTime = performance.now();
    this.leafGrowStart = 0;
    this.phase = 'branches';
  }

  update() {
    if (this.phase === 'idle') return false;

    if (this.phase === 'branches') {
      const elapsed = performance.now() - this.startTime;
      if (elapsed >= this.branchGrowDuration) {
        this.phase = 'leaves';
        this.leafGrowStart = performance.now();
      }
      return false;
    }

    if (this.phase === 'leaves') {
      const leafElapsed = performance.now() - this.leafGrowStart;
      if (leafElapsed >= LEAF_DURATION) {
        this.phase = 'idle';
        return true; // fully done
      }
    }

    return false;
  }

  // Returns 0-1 growth fraction for a segment at the given depth
  getSegmentGrowth(depth) {
    if (this.phase !== 'branches') return 1;

    const elapsed = performance.now() - this.startTime;
    const segStart = depth * DEPTH_DELAY;
    return Math.max(0, Math.min(1, (elapsed - segStart) / SEG_GROW_DURATION));
  }

  isGrowingBranches() {
    return this.phase === 'branches';
  }

  isAnimating() {
    return this.phase !== 'idle';
  }

  getLeafGrowthTime() {
    return this.leafGrowStart;
  }
}
