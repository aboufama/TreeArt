// Deterministic random number generator
// Ported from original Canvas 2D implementation

export class SeededRandom {
  constructor(initialSeed = Math.random() * 100000) {
    this.initialSeed = initialSeed;
    this.seed = initialSeed;
  }

  reset() {
    this.seed = this.initialSeed;
  }

  setSeed(newSeed) {
    this.initialSeed = newSeed;
    this.seed = newSeed;
  }

  // Core random function - returns 0 to 1
  random() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Random in range [min, max)
  range(min, max) {
    return min + this.random() * (max - min);
  }

  // Random integer in range [min, max]
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // Random boolean with probability
  chance(probability = 0.5) {
    return this.random() < probability;
  }

  // Pick random element from array
  pick(array) {
    return array[Math.floor(this.random() * array.length)];
  }
}

// Global instance for shared use
export const rng = new SeededRandom();
