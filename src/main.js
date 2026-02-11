import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';
import { PostProcessing } from './scene/PostProcessing.js';
import { TreeGenerator } from './tree/TreeGenerator.js';
import { BranchGeometry } from './tree/BranchGeometry.js';
import { BranchMaterial } from './tree/BranchMaterial.js';
import { GrowthAnimator } from './tree/GrowthAnimator.js';
import { LeafGenerator } from './leaves/LeafGenerator.js';
import { LeafInstancer } from './leaves/LeafInstancer.js';
import { LeafPhysics } from './leaves/LeafPhysics.js';
import { DetachedLeafRenderer } from './leaves/DetachedLeafRenderer.js';
import { CutDetector } from './cutting/CutDetector.js';
import { CutExecutor } from './cutting/CutExecutor.js';
import { SawdustSystem } from './effects/SawdustSystem.js';
import { MouseTrail } from './effects/MouseTrail.js';
import { SeededRandom } from './utils/SeededRandom.js';

class TreeApp {
  constructor() {
    console.log('TreeApp starting...');

    // Core systems
    this.sceneManager = new SceneManager(document.body);
    this.postProcessing = new PostProcessing(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera
    );

    // Tree systems
    this.treeGenerator = new TreeGenerator();
    this.branchGeometry = new BranchGeometry();
    this.branchMaterial = new BranchMaterial();
    this.growthAnimator = new GrowthAnimator();
    this.branchMesh = null;

    // Leaf systems
    this.leafGenerator = new LeafGenerator();
    this.leafInstancer = new LeafInstancer();
    this.leafPhysics = new LeafPhysics();
    this.detachedLeafRenderer = new DetachedLeafRenderer(this.leafInstancer.geometry.clone());

    // Cutting systems
    this.cutDetector = new CutDetector();
    this.cutExecutor = new CutExecutor(this.branchMaterial);

    // Effects
    this.sawdustSystem = new SawdustSystem();
    this.mouseTrail = new MouseTrail();

    // State
    this.segments = [];
    this.leaves = [];
    this.rng = new SeededRandom();
    this.currentSeed = 0;

    // Add to scene
    this.sceneManager.layers.leaves.add(this.leafInstancer.mesh);
    this.sceneManager.layers.leaves.add(this.detachedLeafRenderer.mesh);
    this.sceneManager.layers.particles.add(this.sawdustSystem.points);
    this.sceneManager.layers.cursor.add(this.mouseTrail.cursorDot);
    this.sceneManager.layers.cursor.add(this.mouseTrail.trailLine);

    // Initialize
    this.setupEvents();
    this.hideLoading();
    this.newTree();
    this.animate();
  }

  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }

  setupEvents() {
    const canvas = this.sceneManager.canvas;

    canvas.addEventListener('mousedown', (e) => {
      const pos = this.getMousePos(e);
      if (this.growthAnimator.isAnimating()) return;

      this.mouseTrail.startSlash(pos.x, pos.y);
      this.leafPhysics.updateMouse(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', (e) => {
      const pos = this.getMousePos(e);
      this.mouseTrail.updateMouse(pos.x, pos.y);
      this.leafPhysics.updateMouse(pos.x, pos.y);

      if (this.mouseTrail.isSlashing && !this.growthAnimator.isAnimating()) {
        const prevX = this.mouseTrail.trail.length > 0
          ? this.mouseTrail.trail[this.mouseTrail.trail.length - 1].x
          : pos.x;
        const prevY = this.mouseTrail.trail.length > 0
          ? this.mouseTrail.trail[this.mouseTrail.trail.length - 1].y
          : pos.y;

        this.mouseTrail.updateSlash(pos.x, pos.y);

        // Check for cuts
        this.checkCut(prevX, prevY, pos.x, pos.y);
      }
    });

    canvas.addEventListener('mouseup', () => {
      this.mouseTrail.endSlash();
    });

    canvas.addEventListener('mouseleave', () => {
      this.mouseTrail.endSlash();
    });

    canvas.addEventListener('dblclick', () => {
      this.newTree();
    });

    window.addEventListener('resize', () => {
      this.postProcessing.resize(
        window.innerWidth,
        window.innerHeight,
        this.sceneManager.renderer.getPixelRatio()
      );
    });
  }

  getMousePos(e) {
    const rect = this.sceneManager.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return this.sceneManager.screenToWorld(screenX, screenY);
  }

  newTree() {
    // Clear previous tree
    if (this.branchMesh) {
      this.sceneManager.layers.branches.remove(this.branchMesh);
      this.branchMesh.geometry.dispose();
    }

    // Clear cutting state
    this.cutExecutor.clear();

    // Clear tree rings from scene
    while (this.sceneManager.layers.treeRings.children.length > 0) {
      const ring = this.sceneManager.layers.treeRings.children[0];
      ring.geometry.dispose();
      ring.material.dispose();
      this.sceneManager.layers.treeRings.remove(ring);
    }

    // Clear falling pieces
    while (this.sceneManager.layers.fallingPieces.children.length > 0) {
      const piece = this.sceneManager.layers.fallingPieces.children[0];
      this.sceneManager.layers.fallingPieces.remove(piece);
    }

    // Clear particles and leaves
    this.sawdustSystem.clear();
    this.leafPhysics.clearDetached();

    // Generate new seed
    this.currentSeed = Math.random() * 100000;
    this.treeGenerator.setSeed(this.currentSeed);
    this.leafGenerator.rng.setSeed(this.currentSeed + 1000);

    // Generate tree structure
    this.segments = this.treeGenerator.generate(
      this.sceneManager.trunkX,
      this.sceneManager.trunkBottomY,
      this.sceneManager.height
    );

    // Update cut detector
    this.cutDetector.setSegments(this.segments);

    // Build initial geometry
    const geometry = this.branchGeometry.build(this.segments);
    this.branchMesh = new THREE.Mesh(geometry, this.branchMaterial);
    this.sceneManager.layers.branches.add(this.branchMesh);

    // Generate leaves
    this.leaves = this.leafGenerator.generate(this.segments);
    this.leafInstancer.setLeaves(this.leaves);

    // Start growth animation
    this.growthAnimator.start();
  }

  checkCut(x1, y1, x2, y2) {
    // Check standing tree first
    const hit = this.cutDetector.findIntersectingBranch(
      x1, y1, x2, y2,
      this.cutExecutor.cutBranches
    );

    if (hit) {
      const slashDir = x2 > x1 ? 1 : -1;
      this.cutExecutor.cutBranch(
        this.segments,
        hit.seg,
        hit.hitX,
        hit.hitY,
        hit.t,
        slashDir,
        this.leaves,
        this.sceneManager
      );

      // Spawn sawdust
      this.sawdustSystem.spawn(hit.hitX, hit.hitY);

      // Rebuild branch geometry
      this.rebuildBranchGeometry();
      return;
    }

    // Check falling pieces
    this.cutDetector.setFallingPieces(this.cutExecutor.fallingPieces);
    const fallHit = this.cutDetector.findIntersectingFallingPiece(x1, y1, x2, y2);

    if (fallHit) {
      const slashDir = x2 > x1 ? 1 : -1;
      this.cutExecutor.cutFallingPiece(fallHit, slashDir, this.sceneManager);

      // Spawn sawdust at world position
      const cos = Math.cos(fallHit.piece.rotation);
      const sin = Math.sin(fallHit.piece.rotation);
      const worldX = fallHit.piece.x + fallHit.hitX * cos - fallHit.hitY * sin;
      const worldY = fallHit.piece.y + fallHit.hitX * sin + fallHit.hitY * cos;
      this.sawdustSystem.spawn(worldX, worldY);
    }
  }

  rebuildBranchGeometry() {
    const newGeometry = this.branchGeometry.build(
      this.segments,
      this.cutExecutor.cutBranches
    );

    this.branchMesh.geometry.dispose();
    this.branchMesh.geometry = newGeometry;
  }

  update(time) {
    // Update leaf pop-in animation
    this.growthAnimator.update();

    // Update falling pieces
    const groundY = this.sceneManager.trunkBottomY;
    this.cutExecutor.update(
      groundY,
      (amount) => this.sceneManager.shake(amount)
    );

    // Add newly spawned pieces to scene
    for (const piece of this.cutExecutor.fallingPieces) {
      if (!piece.mesh.parent) {
        this.sceneManager.layers.fallingPieces.add(piece.mesh);
      }
    }

    // Update leaves (wind physics only after pop-in completes)
    if (!this.growthAnimator.isAnimating()) {
      this.leafPhysics.update(this.leaves, this.cutExecutor.cutBranches);
      this.leafPhysics.updateDetachedLeaves(this.sceneManager.height);
    }

    this.leafInstancer.updateInstances(
      this.cutExecutor.cutBranches,
      this.growthAnimator.getLeafGrowthTime()
    );
    this.leafInstancer.update(time);

    // Update detached leaves
    this.detachedLeafRenderer.update(this.leafPhysics.detachedLeaves, time);

    // Update effects
    this.sawdustSystem.update(this.sceneManager.height);
    this.mouseTrail.update();

    // Update materials
    this.branchMaterial.update(time);
    this.cutExecutor.treeRingGenerator.update(time);

    // Update post-processing
    this.postProcessing.update(time);
  }

  render() {
    this.sceneManager.update();
    this.postProcessing.render();
  }

  animate() {
    const time = performance.now() / 1000;

    this.update(time);
    this.render();

    requestAnimationFrame(() => this.animate());
  }
}

// Start the app
new TreeApp();
