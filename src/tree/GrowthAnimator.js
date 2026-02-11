const BASE_DURATION = 350;     // ms base time for a segment to grow
const DURATION_VARIANCE = 350; // ms random variation — big range for visible differences
const LEAF_POP_DURATION = 800; // ms for a leaf to pop in after its segment finishes

export class GrowthAnimator {
  constructor() {
    this.startTime = 0;
    this.totalDuration = 0;
    this.maxBranchEnd = 0;
    this.segmentTimings = [];  // [{start, end}] indexed by segment index
    this.phase = 'idle'; // 'growing', 'idle'
  }

  // Walk the tree and assign per-segment start/end times with compounding randomness.
  // No delay between parent and child — child starts the instant parent finishes,
  // but each segment grows at its own random speed.
  assignTimes(segments) {
    this.segmentTimings = new Array(segments.length);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      let segStart;
      if (seg.parent === null || seg.parent === undefined) {
        // Root segment starts immediately
        segStart = 0;
      } else {
        // Child starts the instant its parent finishes — no gap
        const parentTiming = this.segmentTimings[seg.parent];
        segStart = parentTiming.end;
      }

      // Each segment gets its own random duration
      const duration = BASE_DURATION + Math.random() * DURATION_VARIANCE;
      this.segmentTimings[i] = {
        start: segStart,
        end: segStart + duration
      };
    }

    // Find when the last branch finishes growing
    this.maxBranchEnd = 0;
    for (const t of this.segmentTimings) {
      if (t.end > this.maxBranchEnd) this.maxBranchEnd = t.end;
    }

    // Total animation = all branches + time for last leaves to pop in
    this.totalDuration = this.maxBranchEnd + LEAF_POP_DURATION + 200;
  }

  start() {
    this.startTime = performance.now();
    this.phase = 'growing';
  }

  update() {
    if (this.phase === 'idle') return false;

    const elapsed = performance.now() - this.startTime;
    if (elapsed >= this.totalDuration) {
      this.phase = 'idle';
      return true; // fully done
    }

    return false;
  }

  // Returns 0-1 growth fraction for a segment by its index
  getSegmentGrowth(segIndex) {
    if (this.phase === 'idle') return 1;

    const timing = this.segmentTimings[segIndex];
    if (!timing) return 1;

    const elapsed = performance.now() - this.startTime;
    if (elapsed < timing.start) return 0;
    if (elapsed >= timing.end) return 1;

    return (elapsed - timing.start) / (timing.end - timing.start);
  }

  // Returns 0-1 scale for a leaf on a given segment.
  // Leaves start appearing after their segment finishes growing.
  getLeafScale(segIndex) {
    if (this.phase === 'idle') return 1;

    const timing = this.segmentTimings[segIndex];
    if (!timing) return 1;

    const elapsed = performance.now() - this.startTime;
    const leafStart = timing.end;

    if (elapsed < leafStart) return 0;

    const progress = Math.min(1, (elapsed - leafStart) / LEAF_POP_DURATION);
    // Ease-out for smooth pop-in
    return 1 - (1 - progress) * (1 - progress);
  }

  isGrowingBranches() {
    if (this.phase === 'idle') return false;
    const elapsed = performance.now() - this.startTime;
    return elapsed < this.maxBranchEnd;
  }

  isAnimating() {
    return this.phase !== 'idle';
  }
}
