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

    // Hint element
    this.cutHint = document.getElementById('cut-hint');
    this.hintVisible = false;
    this.hasCut = false;

    // Note element
    this.noteEl = document.getElementById('note');
    this.noteShown = false;

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

    // -- Mouse events --
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

    // -- Touch events (mobile) --
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const pos = this.getTouchPos(e);
      if (this.growthAnimator.isAnimating()) return;

      this.mouseTrail.startSlash(pos.x, pos.y);
      this.mouseTrail.updateMouse(pos.x, pos.y);
      this.leafPhysics.updateMouse(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const pos = this.getTouchPos(e);
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
        this.checkCut(prevX, prevY, pos.x, pos.y);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.mouseTrail.endSlash();
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
      this.mouseTrail.endSlash();
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

  getTouchPos(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    const rect = this.sceneManager.canvas.getBoundingClientRect();
    const screenX = touch.clientX - rect.left;
    const screenY = touch.clientY - rect.top;
    return this.sceneManager.screenToWorld(screenX, screenY);
  }

  newTree() {
    // Hide hint and note, reset state
    this.cutHint.classList.remove('visible');
    this.hintVisible = false;
    this.hasCut = false;
    this.noteEl.classList.remove('active');
    this.noteEl.style.transition = 'none';
    this.noteShown = false;

    // Clear previous tree
    if (this.branchMesh) {
      this.sceneManager.layers.branches.remove(this.branchMesh);
      this.branchMesh.geometry.dispose();
    }

    // Clear cutting state
    this.cutExecutor.clear();

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

    // Create branch mesh (starts empty, growth animation fills it)
    const geometry = this.branchGeometry.build(this.segments, new Set(), () => 0);
    this.branchMesh = new THREE.Mesh(geometry, this.branchMaterial);
    this.sceneManager.layers.branches.add(this.branchMesh);

    // Generate leaves
    this.leaves = this.leafGenerator.generate(this.segments);
    this.leafInstancer.setLeaves(this.leaves);

    // Assign per-segment growth timing and start animation
    this.growthAnimator.assignTimes(this.segments);
    this.growthAnimator.start();
  }

  checkCut(x1, y1, x2, y2) {
    // Check standing tree first
    const hit = this.cutDetector.findIntersectingBranch(
      x1, y1, x2, y2,
      this.cutExecutor.cutBranches
    );

    if (hit) {
      // Hide hint on first cut
      if (this.hintVisible) {
        this.cutHint.classList.remove('visible');
        this.hintVisible = false;
        this.hasCut = true;
      }

      const slashDir = x2 > x1 ? 1 : -1;
      this.cutExecutor.cutBranch(
        this.segments,
        hit.seg,
        hit.hitX,
        hit.hitY,
        hit.t,
        slashDir,
        this.leaves,
        this.sceneManager,
        (leaf, dir) => this.leafPhysics.detachLeafFromCut(leaf, dir)
      );

      // Spawn sawdust
      this.sawdustSystem.spawn(hit.hitX, hit.hitY);

      // Show note when trunk is cut
      if (!this.noteShown && hit.seg.depth <= 1) {
        this.showNote(hit.hitX, hit.hitY);
      }

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

  showNote(worldX, worldY) {
    this.noteShown = true;
    const screen = this.sceneManager.worldToScreen(worldX, worldY);

    // Position at cut point, then float up
    const targetY = Math.max(60, screen.y - 300);

    // Set starting position (tiny, at cut point)
    this.noteEl.style.transition = 'none';
    this.noteEl.style.left = screen.x + 'px';
    this.noteEl.style.top = screen.y + 'px';
    this.noteEl.classList.remove('active');
    void this.noteEl.offsetWidth; // force reflow

    // 1 second delay, then rise and unfold
    setTimeout(() => {
      this.noteEl.style.transition = '';
      this.noteEl.style.top = targetY + 'px';
      this.noteEl.classList.add('active');
    }, 1000);
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
    // Update growth animation
    const wasAnimating = this.growthAnimator.isAnimating();
    const wasGrowingBranches = this.growthAnimator.isGrowingBranches();
    this.growthAnimator.update();

    // Show hint when growth finishes
    if (wasAnimating && !this.growthAnimator.isAnimating() && !this.hasCut) {
      this.cutHint.classList.add('visible');
      this.hintVisible = true;
    }

    // Rebuild branch geometry during growth
    if (this.growthAnimator.isGrowingBranches()) {
      // Still growing — partial rebuild with interpolated segments
      const getGrowth = (segIndex) => this.growthAnimator.getSegmentGrowth(segIndex);
      this.branchGeometry.build(
        this.segments,
        this.cutExecutor.cutBranches,
        getGrowth
      );
    } else if (wasGrowingBranches) {
      // Just finished growing — final full rebuild
      this.branchGeometry.build(this.segments, this.cutExecutor.cutBranches);
    }

    // Update falling pieces
    const groundY = this.sceneManager.trunkBottomY;
    this.cutExecutor.update(
      groundY,
      (amount) => this.sceneManager.shake(amount),
      (shedLeaves) => this.leafPhysics.detachedLeaves.push(...shedLeaves)
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
      (segIndex) => this.growthAnimator.getLeafScale(segIndex)
    );
    this.leafInstancer.update(time);

    // Collect all visible riding + detached leaves for rendering
    // Riding leaves first so they have priority in the instance limit
    const allDetached = [];
    for (const piece of this.cutExecutor.fallingPieces) {
      allDetached.push(...piece.getWorldLeaves());
    }
    allDetached.push(...this.leafPhysics.detachedLeaves);
    this.detachedLeafRenderer.update(allDetached, time);

    // Update effects
    this.sawdustSystem.update(this.sceneManager.height);
    this.mouseTrail.update();

    // Update materials
    this.branchMaterial.update(time);

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

// Password gate
const pwScreen = document.getElementById('password-screen');
const pwInput = document.getElementById('pw');
const pwSubmit = document.getElementById('pw-submit');

function tryPassword() {
  if (pwInput.value.toLowerCase().trim() === 'tree') {
    pwScreen.classList.add('fade-out');
    setTimeout(() => {
      pwScreen.classList.add('hidden');
      new TreeApp();
    }, 800);
  } else {
    pwInput.classList.add('wrong');
    pwInput.value = '';
    setTimeout(() => pwInput.classList.remove('wrong'), 300);
  }
}

pwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryPassword();
});
pwSubmit.addEventListener('click', tryPassword);
