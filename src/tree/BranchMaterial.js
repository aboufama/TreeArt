import * as THREE from 'three';
import branchVertShader from '../shaders/branch.vert';
import branchFragShader from '../shaders/branch.frag';

export class BranchMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: branchVertShader,
      fragmentShader: branchFragShader,
      uniforms: {
        time: { value: 0 }
      },
      side: THREE.DoubleSide,
      transparent: false
    });
  }

  update(time) {
    this.uniforms.time.value = time;
  }
}
