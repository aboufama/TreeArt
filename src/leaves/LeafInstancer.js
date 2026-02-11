import * as THREE from 'three';
import { LeafMaterial } from './LeafMaterial.js';
import { hexToColor } from '../utils/ColorUtils.js';

const MAX_LEAVES = 2000;

export class LeafInstancer {
  constructor() {
    this.geometry = this.createMapleLeafGeometry();
    this.material = new LeafMaterial();
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_LEAVES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    // Instance attributes
    this.instanceColors = new Float32Array(MAX_LEAVES * 3);
    this.instanceScales = new Float32Array(MAX_LEAVES);
    this.instanceWindPhases = new Float32Array(MAX_LEAVES);

    this.geometry.setAttribute('instanceColor',
      new THREE.InstancedBufferAttribute(this.instanceColors, 3));
    this.geometry.setAttribute('instanceScale',
      new THREE.InstancedBufferAttribute(this.instanceScales, 1));
    this.geometry.setAttribute('instanceWindPhase',
      new THREE.InstancedBufferAttribute(this.instanceWindPhases, 1));

    this.leaves = [];
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.euler = new THREE.Euler();
  }

  createMapleLeafGeometry() {
    // Create 5-lobed maple leaf shape
    const shape = new THREE.Shape();
    const s = 1;

    // Start at top point
    shape.moveTo(0, -s * 0.5);

    // Right side of center top
    shape.quadraticCurveTo(s * 0.12, -s * 0.35, s * 0.2, -s * 0.4);
    // Upper right point
    shape.lineTo(s * 0.45, -s * 0.35);
    // Inner notch
    shape.quadraticCurveTo(s * 0.28, -s * 0.18, s * 0.25, -s * 0.08);
    // Right point
    shape.lineTo(s * 0.5, s * 0.05);
    // Lower inner notch
    shape.quadraticCurveTo(s * 0.25, s * 0.08, s * 0.18, s * 0.2);
    // Lower right point
    shape.lineTo(s * 0.25, s * 0.4);
    // Bottom center
    shape.quadraticCurveTo(s * 0.1, s * 0.28, 0, s * 0.3);

    // Mirror left side
    shape.quadraticCurveTo(-s * 0.1, s * 0.28, -s * 0.25, s * 0.4);
    shape.lineTo(-s * 0.18, s * 0.2);
    shape.quadraticCurveTo(-s * 0.25, s * 0.08, -s * 0.5, s * 0.05);
    shape.lineTo(-s * 0.25, -s * 0.08);
    shape.quadraticCurveTo(-s * 0.28, -s * 0.18, -s * 0.45, -s * 0.35);
    shape.lineTo(-s * 0.2, -s * 0.4);
    shape.quadraticCurveTo(-s * 0.12, -s * 0.35, 0, -s * 0.5);

    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);

    // Flip Y to match screen coordinates
    const positions = geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] = -positions[i];
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();

    return geometry;
  }

  setLeaves(leaves, cutBranches = new Set()) {
    this.leaves = leaves;
    this.updateInstances(cutBranches);
  }

  updateInstances(cutBranches = new Set(), growthProgress = 1, leafGrowStart = 0) {
    const now = performance.now();
    const elapsed = (now - leafGrowStart) / 1000;
    const growDuration = 1.5;

    let visibleCount = 0;

    for (let i = 0; i < this.leaves.length && i < MAX_LEAVES; i++) {
      const leaf = this.leaves[i];

      if (leaf.size <= 0 || cutBranches.has(leaf.segIndex)) {
        continue;
      }

      // Calculate growth progress for staggered pop-in
      const stagger = (leaf.depth - 3) * 0.1;
      const leafProgress = Math.max(0, Math.min(1, (elapsed - stagger) / growDuration));

      if (leafProgress <= 0 && growthProgress < 1) continue;

      // Ease-out for smooth pop-in
      const scale = growthProgress >= 1
        ? (1 - (1 - leafProgress) * (1 - leafProgress))
        : 1;

      // Set position including wind offset
      const drawX = leaf.x + leaf.ox;
      const drawY = leaf.y + leaf.oy;

      this.position.set(drawX, drawY, 0.1);
      this.euler.set(0, 0, leaf.angle);
      this.quaternion.setFromEuler(this.euler);
      this.scale.set(leaf.size * scale, leaf.size * scale, 1);

      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(visibleCount, this.matrix);

      // Set color
      const color = hexToColor(leaf.color);
      this.instanceColors[visibleCount * 3] = color.r;
      this.instanceColors[visibleCount * 3 + 1] = color.g;
      this.instanceColors[visibleCount * 3 + 2] = color.b;

      // Set scale for alpha in shader
      this.instanceScales[visibleCount] = scale;

      // Set wind phase for variety
      this.instanceWindPhases[visibleCount] = i * 0.1;

      visibleCount++;
    }

    this.mesh.count = visibleCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.geometry.attributes.instanceColor.needsUpdate = true;
    this.geometry.attributes.instanceScale.needsUpdate = true;
  }

  update(time) {
    this.material.update(time);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
