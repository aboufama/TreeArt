import * as THREE from 'three';
import leafVertShader from '../shaders/leaf.vert';
import leafFragShader from '../shaders/leaf.frag';

export class LeafMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: leafVertShader,
      fragmentShader: leafFragShader,
      uniforms: {
        time: { value: 0 }
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false
    });
  }

  update(time) {
    this.uniforms.time.value = time;
  }
}
