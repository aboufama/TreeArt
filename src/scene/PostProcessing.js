import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Watercolor/Painterly post-processing shader
const PainterlyShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2() },
    time: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    varying vec2 vUv;

    // Simple noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 uv = vUv;

      // Subtle UV distortion for watercolor bleed effect
      vec2 noiseCoord = uv * 3.0 + time * 0.005;
      vec2 distortion = vec2(
        noise(noiseCoord) - 0.5,
        noise(noiseCoord + 100.0) - 0.5
      ) * 0.003;
      uv += distortion;

      // Sample with slight offset for soft edges
      vec4 color = texture2D(tDiffuse, uv);

      // Edge detection for outline effect
      vec2 texel = 1.0 / resolution;
      vec4 left = texture2D(tDiffuse, uv - vec2(texel.x, 0.0));
      vec4 right = texture2D(tDiffuse, uv + vec2(texel.x, 0.0));
      vec4 up = texture2D(tDiffuse, uv - vec2(0.0, texel.y));
      vec4 down = texture2D(tDiffuse, uv + vec2(0.0, texel.y));

      float edge = length(color.rgb - left.rgb) + length(color.rgb - right.rgb) +
                   length(color.rgb - up.rgb) + length(color.rgb - down.rgb);
      edge = smoothstep(0.0, 0.3, edge);

      // Subtle edge darkening
      color.rgb *= 1.0 - edge * 0.15;

      // Paper texture overlay
      float paper = noise(vUv * 8.0 + 50.0);
      color.rgb = mix(color.rgb, color.rgb * (0.92 + paper * 0.16), 0.25);

      // Soft vignette
      float vignette = 1.0 - length(vUv - 0.5) * 0.4;
      vignette = smoothstep(0.4, 1.0, vignette);
      color.rgb *= vignette;

      // Warm color grading for autumn feel
      color.r *= 1.04;
      color.g *= 1.01;
      color.b *= 0.94;

      // Subtle saturation boost
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(gray), color.rgb, 1.08);

      gl_FragColor = color;
    }
  `
};

export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);

    // Base render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Painterly/watercolor effect
    this.painterlyPass = new ShaderPass(PainterlyShader);
    this.painterlyPass.uniforms.resolution.value.set(
      window.innerWidth * renderer.getPixelRatio(),
      window.innerHeight * renderer.getPixelRatio()
    );
    this.composer.addPass(this.painterlyPass);

    this.enabled = true;
  }

  resize(width, height, pixelRatio) {
    this.composer.setSize(width, height);
    this.painterlyPass.uniforms.resolution.value.set(
      width * pixelRatio,
      height * pixelRatio
    );
  }

  update(time) {
    this.painterlyPass.uniforms.time.value = time;
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    }
  }

  dispose() {
    this.composer.dispose();
  }
}
