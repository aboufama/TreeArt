import * as THREE from 'three';
import { COLORS } from '../utils/ColorUtils.js';

export class SceneManager {
  constructor(container) {
    this.container = container || document.body;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(COLORS.background, 1);
    this.renderer.sortObjects = true;
    this.container.appendChild(this.renderer.domElement);

    // Create scene
    this.scene = new THREE.Scene();

    // Create orthographic camera for 2D projection
    // We'll set up the camera to match screen pixels
    this.camera = new THREE.OrthographicCamera(
      0, window.innerWidth,    // left, right
      0, -window.innerHeight,  // top, bottom (inverted for screen coords)
      0.1, 1000
    );
    this.camera.position.z = 500;

    // Screen shake offset
    this.shakeAmount = 0;
    this.shakeDecay = 0.85;

    // Handle resize
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Create layer groups for z-ordering
    this.layers = {
      branches: new THREE.Group(),
      treeRings: new THREE.Group(),
      leaves: new THREE.Group(),
      fallingPieces: new THREE.Group(),
      particles: new THREE.Group(),
      cursor: new THREE.Group()
    };

    // Set render order
    this.layers.branches.renderOrder = 0;
    this.layers.treeRings.renderOrder = 1;
    this.layers.leaves.renderOrder = 2;
    this.layers.fallingPieces.renderOrder = 3;
    this.layers.particles.renderOrder = 4;
    this.layers.cursor.renderOrder = 5;

    // Add all layers to scene
    Object.values(this.layers).forEach(layer => this.scene.add(layer));
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);

    // Update orthographic camera to match screen dimensions
    this.camera.left = 0;
    this.camera.right = width;
    this.camera.top = 0;
    this.camera.bottom = -height;
    this.camera.updateProjectionMatrix();

    this.width = width;
    this.height = height;
  }

  get canvas() {
    return this.renderer.domElement;
  }

  get trunkX() {
    return this.width / 2;
  }

  get trunkBottomY() {
    return -this.height;
  }

  shake(amount) {
    this.shakeAmount = Math.min(this.shakeAmount + amount, 10);
  }

  update() {
    // Apply screen shake
    if (this.shakeAmount > 0.5) {
      const offsetX = (Math.random() - 0.5) * this.shakeAmount;
      const offsetY = (Math.random() - 0.5) * this.shakeAmount;
      this.scene.position.set(offsetX, offsetY, 0);
      this.shakeAmount *= this.shakeDecay;
    } else {
      this.scene.position.set(0, 0, 0);
      this.shakeAmount = 0;
    }
  }

  render() {
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: screenX,
      y: -screenY  // Invert Y for Three.js coordinate system
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: worldX,
      y: -worldY
    };
  }

  dispose() {
    this.renderer.dispose();
    window.removeEventListener('resize', this.resize);
  }
}
