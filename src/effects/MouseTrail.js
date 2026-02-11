import * as THREE from 'three';

const MAX_TRAIL_POINTS = 20;

export class MouseTrail {
  constructor() {
    this.trail = [];
    this.isSlashing = false;
    this.mouseX = 0;
    this.mouseY = 0;

    // Detect touch device
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Create cursor dot (hidden on touch devices)
    const dotGeometry = new THREE.CircleGeometry(4, 16);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: 0x3C2D1E,
      transparent: true,
      opacity: 0.4
    });
    this.cursorDot = new THREE.Mesh(dotGeometry, dotMaterial);
    this.cursorDot.position.z = 0.5;
    this.cursorDot.visible = !this.isTouchDevice;

    // Track idle time for hiding dot when not moving
    this.lastMoveTime = 0;
    this.dotVisible = !this.isTouchDevice;

    // Create trail line
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
    this.trailGeometry.setAttribute('position',
      new THREE.BufferAttribute(this.trailPositions, 3));

    this.trailMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float lineProgress;
        varying float vProgress;

        void main() {
          vProgress = lineProgress;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vProgress;
        uniform float opacity;

        void main() {
          float alpha = vProgress * opacity * 0.45;
          gl_FragColor = vec4(0.235, 0.176, 0.118, alpha);
        }
      `,
      uniforms: {
        opacity: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false
    });

    // Use line segments for variable width effect
    this.trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.trailLine.position.z = 0.4;
    this.trailLine.visible = false;
  }

  startSlash(x, y) {
    this.isSlashing = true;
    this.trail = [{ x, y, life: 1 }];
    this.mouseX = x;
    this.mouseY = y;
    this.updateTrailGeometry();
  }

  updateSlash(x, y) {
    if (!this.isSlashing) return;

    const dist = Math.sqrt((x - this.mouseX) ** 2 + (y - this.mouseY) ** 2);
    if (dist > 2) {
      this.trail.push({ x, y, life: 1 });
      if (this.trail.length > MAX_TRAIL_POINTS) {
        this.trail.shift();
      }
    }

    this.mouseX = x;
    this.mouseY = y;
    this.updateTrailGeometry();
  }

  endSlash() {
    this.isSlashing = false;
    this.trail = [];
    this.trailLine.visible = false;
  }

  updateMouse(x, y) {
    this.mouseX = x;
    this.mouseY = y;
    this.cursorDot.position.set(x, y, 0.5);
    this.lastMoveTime = performance.now();
    if (!this.isTouchDevice) {
      this.dotVisible = true;
    }
  }

  update() {
    // Fade trail points
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= 0.1;
      if (this.trail[i].life <= 0) {
        this.trail.splice(i, 1);
      }
    }

    if (this.isSlashing && this.trail.length >= 2) {
      this.updateTrailGeometry();
      this.trailLine.visible = true;
    } else {
      this.trailLine.visible = false;
    }

    // Update cursor visibility — hidden on touch devices, fades after idle on desktop
    if (this.isTouchDevice) {
      this.cursorDot.visible = false;
    } else {
      const idle = performance.now() - this.lastMoveTime > 2000;
      if (idle) this.dotVisible = false;
      this.cursorDot.visible = this.dotVisible && (!this.isSlashing || this.trail.length < 2);
    }
  }

  updateTrailGeometry() {
    // Add line progress attribute if not exists
    if (!this.trailGeometry.attributes.lineProgress) {
      const progressArray = new Float32Array(MAX_TRAIL_POINTS);
      this.trailGeometry.setAttribute('lineProgress',
        new THREE.BufferAttribute(progressArray, 1));
    }

    const positions = this.trailGeometry.attributes.position.array;
    const progress = this.trailGeometry.attributes.lineProgress.array;

    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      if (i < this.trail.length) {
        positions[i * 3] = this.trail[i].x;
        positions[i * 3 + 1] = this.trail[i].y;
        positions[i * 3 + 2] = 0.4;
        progress[i] = this.trail[i].life;
      } else {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        progress[i] = 0;
      }
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.lineProgress.needsUpdate = true;
    this.trailGeometry.setDrawRange(0, this.trail.length);
  }

  getSlashSegment() {
    if (this.trail.length < 2) return null;

    const prev = this.trail[this.trail.length - 2];
    const curr = this.trail[this.trail.length - 1];

    return {
      x1: prev.x,
      y1: prev.y,
      x2: curr.x,
      y2: curr.y
    };
  }

  dispose() {
    this.cursorDot.geometry.dispose();
    this.cursorDot.material.dispose();
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
  }
}
