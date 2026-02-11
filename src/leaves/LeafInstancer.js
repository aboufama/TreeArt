import * as THREE from 'three';
import { LeafMaterial } from './LeafMaterial.js';
import { hexToColor } from '../utils/ColorUtils.js';

const MAX_LEAVES = 2000;

export class LeafInstancer {
  constructor() {
    this.geometry = this.createLeafGeometry();
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

  createLeafGeometry() {
    // Natural leaf shape: pointed tip, wide body, tapered stem
    const shape = new THREE.Shape();

    // Start at stem (bottom center)
    shape.moveTo(0, -0.5);

    // Right side — curves out to widest point then narrows to tip
    shape.bezierCurveTo(0.18, -0.42, 0.38, -0.18, 0.4, 0.0);
    shape.bezierCurveTo(0.38, 0.18, 0.22, 0.38, 0, 0.55);

    // Left side — mirror back down to stem
    shape.bezierCurveTo(-0.22, 0.38, -0.38, 0.18, -0.4, 0.0);
    shape.bezierCurveTo(-0.38, -0.18, -0.18, -0.42, 0, -0.5);

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

  setLeaves(leaves) {
    this.leaves = leaves;
    // Don't render yet — the animation loop handles pop-in via updateInstances
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  updateInstances(cutBranches = new Set(), getLeafScale = null) {
    let visibleCount = 0;

    for (let i = 0; i < this.leaves.length && i < MAX_LEAVES; i++) {
      const leaf = this.leaves[i];

      if (leaf.size <= 0 || cutBranches.has(leaf.segIndex)) {
        continue;
      }

      // Get scale from growth animator (0 = hidden, 0-1 = popping in, 1 = full)
      const scale = getLeafScale ? getLeafScale(leaf.segIndex) : 1;

      if (scale <= 0) continue;

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
