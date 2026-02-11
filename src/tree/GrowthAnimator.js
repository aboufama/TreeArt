export class GrowthAnimator {
  constructor() {
    this.isGrowing = false;
    this.growProgress = 0;
    this.growSpeed = 0.003;
    this.growthComplete = false;
    this.leafGrowStart = 0;
    this.leavesGrowing = false;
  }

  start() {
    this.isGrowing = true;
    this.growProgress = 0;
    this.growthComplete = false;
    this.leavesGrowing = false;
  }

  update() {
    if (!this.isGrowing) return false;

    this.growProgress += this.growSpeed;

    if (this.growProgress >= 1) {
      this.growProgress = 1;
      this.isGrowing = false;
      this.growthComplete = true;
      this.startLeafGrowth();
      return true; // Growth just completed
    }

    return false;
  }

  startLeafGrowth() {
    this.leavesGrowing = true;
    this.leafGrowStart = performance.now();
  }

  getGrowthProgress() {
    return this.growProgress;
  }

  isComplete() {
    return this.growthComplete;
  }

  isAnimating() {
    return this.isGrowing;
  }

  getLeafGrowthTime() {
    return this.leafGrowStart;
  }

  reset() {
    this.isGrowing = false;
    this.growProgress = 0;
    this.growthComplete = false;
    this.leafGrowStart = 0;
    this.leavesGrowing = false;
  }
}
