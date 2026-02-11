import * as THREE from 'three';
import { LeafMaterial } from './LeafMaterial.js';
import { hexToColor } from '../utils/ColorUtils.js';

const MAX_DETACHED = 500;

export class DetachedLeafRenderer {
  constructor(leafGeometry) {
    // Clone geometry and remove existing instance attributes
    this.geometry = leafGeometry.clone();
    if (this.geometry.attributes.instanceColor) {
      this.geometry.deleteAttribute('instanceColor');
    }
    if (this.geometry.attributes.instanceScale) {
      this.geometry.deleteAttribute('instanceScale');
    }
    if (this.geometry.attributes.instanceWindPhase) {
      this.geometry.deleteAttribute('instanceWindPhase');
    }

    this.material = new LeafMaterial();
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_DETACHED);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    // Instance attributes
    this.instanceColors = new Float32Array(MAX_DETACHED * 3);
    this.instanceScales = new Float32Array(MAX_DETACHED);
    this.instanceWindPhases = new Float32Array(MAX_DETACHED);

    this.geometry.setAttribute('instanceColor',
      new THREE.InstancedBufferAttribute(this.instanceColors, 3));
    this.geometry.setAttribute('instanceScale',
      new THREE.InstancedBufferAttribute(this.instanceScales, 1));
    this.geometry.setAttribute('instanceWindPhase',
      new THREE.InstancedBufferAttribute(this.instanceWindPhases, 1));

    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.euler = new THREE.Euler();
  }

  update(detachedLeaves, time) {
    let count = 0;

    for (let i = 0; i < detachedLeaves.length && i < MAX_DETACHED; i++) {
      const leaf = detachedLeaves[i];

      this.position.set(leaf.x, leaf.y, 0.15);
      this.euler.set(0, 0, leaf.angle);
      this.quaternion.setFromEuler(this.euler);
      this.scale.set(leaf.size, leaf.size, 1);

      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(count, this.matrix);

      const color = hexToColor(leaf.color);
      this.instanceColors[count * 3] = color.r;
      this.instanceColors[count * 3 + 1] = color.g;
      this.instanceColors[count * 3 + 2] = color.b;

      this.instanceScales[count] = leaf.life;
      this.instanceWindPhases[count] = i * 0.1;

      count++;
    }

    this.mesh.count = count;
    if (count > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.geometry.attributes.instanceColor.needsUpdate = true;
      this.geometry.attributes.instanceScale.needsUpdate = true;
    }

    this.material.update(time);
  }

  dispose() {
    this.material.dispose();
  }
}
