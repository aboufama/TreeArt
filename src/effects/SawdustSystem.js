import * as THREE from 'three';
import { COLORS } from '../utils/ColorUtils.js';

const MAX_PARTICLES = 500;

export class SawdustSystem {
  constructor() {
    this.particles = [];

    // Create geometry for GPU particles
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);

    this.geometry.setAttribute('position',
      new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color',
      new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size',
      new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('alpha',
      new THREE.BufferAttribute(this.alphas, 1));

    // Custom shader material for particles
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          vAlpha = alpha;
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          // Soft square particle
          vec2 center = gl_PointCoord - 0.5;
          float dist = max(abs(center.x), abs(center.y));
          float alpha = vAlpha * (1.0 - smoothstep(0.3, 0.5, dist));

          if (alpha < 0.01) discard;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;

    // Parse sawdust colors
    this.sawdustColors = COLORS.sawdust.map(hex => new THREE.Color(hex));
  }

  spawn(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) {
        // Remove oldest particle
        this.particles.shift();
      }

      const color = this.sawdustColors[Math.floor(Math.random() * this.sawdustColors.length)];

      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y,
        z: 0.2,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 2 + 1,
        size: Math.random() * 2.5 + 1,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        color: color,
        life: 1
      });
    }
  }

  update(canvasHeight) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.12; // Gravity (inverted Y)
      p.vx *= 0.98;
      p.rotation += p.rotationSpeed;
      p.life -= 0.015;

      if (p.life <= 0 || p.y < -canvasHeight) {
        this.particles.splice(i, 1);
      }
    }

    // Update GPU buffers
    this.updateBuffers();
  }

  updateBuffers() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;
        this.colors[i * 3] = p.color.r;
        this.colors[i * 3 + 1] = p.color.g;
        this.colors[i * 3 + 2] = p.color.b;
        this.sizes[i] = p.size;
        this.alphas[i] = p.life;
      } else {
        this.alphas[i] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
  }

  clear() {
    this.particles = [];
    this.updateBuffers();
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
