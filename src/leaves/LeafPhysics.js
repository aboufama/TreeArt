export class LeafPhysics {
  constructor() {
    this.mouseX = 0;
    this.mouseY = 0;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.mouseSpeed = 0;
    this.windRadius = 45;
    this.windForce = 0.6;
    this.detachedLeaves = [];
  }

  updateMouse(x, y) {
    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
    this.mouseX = x;
    this.mouseY = y;
    this.mouseSpeed = Math.sqrt(
      (x - this.prevMouseX) ** 2 + (y - this.prevMouseY) ** 2
    );
  }

  update(leaves, cutBranches = new Set()) {
    if (!leaves || leaves.length === 0) return;

    for (const leaf of leaves) {
      if (cutBranches.has(leaf.segIndex)) continue;
      if (leaf.size <= 0) continue;

      // Check distance to mouse
      const lx = (leaf.x + leaf.ox) - this.mouseX;
      const ly = (leaf.y + leaf.oy) - this.mouseY;
      const distSq = lx * lx + ly * ly;
      const dist = Math.sqrt(distSq);

      if (dist < this.windRadius && dist > 0.1 && this.mouseSpeed > 1) {
        const strength = (1 - dist / this.windRadius) * this.windForce;
        leaf.vx += (lx / dist) * strength;
        leaf.vy += (ly / dist) * strength;

        // Small chance to detach leaf when mouse is moving nearby
        if (dist < this.windRadius * 0.6 && Math.random() < 0.006) {
          this.detachLeaf(leaf);
        }
      }

      // Spring back to original position + heavy damping
      leaf.vx += -leaf.ox * 0.05;
      leaf.vy += -leaf.oy * 0.05;
      leaf.vx *= 0.82;
      leaf.vy *= 0.82;
      leaf.ox += leaf.vx;
      leaf.oy += leaf.vy;
    }
  }

  detachLeaf(leaf) {
    this._createDetached(leaf,
      leaf.vx * 0.5 + (Math.random() - 0.5) * 1.5,
      leaf.vy * 0.3 + 0.5
    );
  }

  detachLeafFromCut(leaf, slashDir) {
    this._createDetached(leaf,
      slashDir * (1 + Math.random() * 2) + (Math.random() - 0.5),
      1 + Math.random() * 1.5
    );
  }

  _createDetached(leaf, vx, vy) {
    this.detachedLeaves.push({
      x: leaf.x + leaf.ox,
      y: leaf.y + leaf.oy,
      vx, vy,
      size: leaf.size,
      angle: leaf.angle,
      angularVel: (Math.random() - 0.5) * 0.08,
      color: leaf.color,
      life: 1,
      flutter: Math.random() * Math.PI * 2,
      flutterSpeed: 0.03 + Math.random() * 0.03
    });

    // Mark original leaf as gone
    leaf.size = 0;
  }

  updateDetachedLeaves(canvasHeight) {
    for (let i = this.detachedLeaves.length - 1; i >= 0; i--) {
      const dl = this.detachedLeaves[i];

      // Gentle gravity
      dl.vy -= 0.04;

      // Flutter sideways
      dl.flutter += dl.flutterSpeed;
      dl.vx += Math.sin(dl.flutter) * 0.12;

      // Air resistance
      dl.vx *= 0.98;
      dl.vy *= 0.99;

      // Cap falling speed for gentle drift
      if (dl.vy < -1.8) dl.vy = -1.8;

      dl.x += dl.vx;
      dl.y += dl.vy;
      dl.angle += dl.angularVel;
      dl.angularVel += Math.sin(dl.flutter) * 0.003;
      dl.angularVel *= 0.98;

      // Fade when near ground
      if (dl.y < -canvasHeight + 40) {
        dl.life -= 0.025;
      }

      // Remove if off screen or faded
      if (dl.life <= 0 || dl.y < -canvasHeight - 20) {
        this.detachedLeaves.splice(i, 1);
      }
    }
  }

  clearDetached() {
    this.detachedLeaves = [];
  }
}
