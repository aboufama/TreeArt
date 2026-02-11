export class GrowthAnimator {
  constructor() {
    this.leafGrowStart = 0;
    this.animating = false;
    this.duration = 2500; // ms for leaf pop-in to fully complete
  }

  start() {
    this.leafGrowStart = performance.now();
    this.animating = true;
  }

  update() {
    if (!this.animating) return false;

    const elapsed = performance.now() - this.leafGrowStart;
    if (elapsed >= this.duration) {
      this.animating = false;
      return true; // animation complete
    }
    return false;
  }

  isAnimating() {
    return this.animating;
  }

  getLeafGrowthTime() {
    return this.leafGrowStart;
  }
}
