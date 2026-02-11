import * as THREE from 'three';
import treeRingVertShader from '../shaders/treeRing.vert';
import treeRingFragShader from '../shaders/treeRing.frag';
import { COLORS } from '../utils/ColorUtils.js';

export class TreeRingGenerator {
  constructor() {
    this.rings = [];
  }

  createCutCap(cutPoint, thickness, branchAngle, branchDepth) {
    const radius = thickness / 2;
    const segments = 32;

    // Create circle geometry
    const geometry = new THREE.CircleGeometry(radius, segments);

    // Rotate to face perpendicular to branch and translate to cut point
    geometry.rotateZ(branchAngle + Math.PI / 2);
    geometry.translate(cutPoint.x, cutPoint.y, 0.05);

    // Calculate ring count based on thickness
    const ringCount = Math.max(3, Math.floor(3 + branchDepth * 0.8));

    // Custom material with tree ring shader
    const material = new THREE.ShaderMaterial({
      vertexShader: treeRingVertShader,
      fragmentShader: treeRingFragShader,
      uniforms: {
        rings: { value: ringCount },
        ringColor: { value: new THREE.Color(COLORS.ringLight) },
        gapColor: { value: new THREE.Color(COLORS.ringDark) },
        centerColor: { value: new THREE.Color(COLORS.heartwood) },
        noiseScale: { value: 0.5 + Math.random() * 0.5 },
        time: { value: 0 }
      },
      transparent: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.rings.push(mesh);

    return mesh;
  }

  update(time) {
    for (const ring of this.rings) {
      ring.material.uniforms.time.value = time;
    }
  }

  removeRing(mesh) {
    const index = this.rings.indexOf(mesh);
    if (index > -1) {
      this.rings.splice(index, 1);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }

  clear() {
    for (const ring of this.rings) {
      ring.geometry.dispose();
      ring.material.dispose();
    }
    this.rings = [];
  }
}
