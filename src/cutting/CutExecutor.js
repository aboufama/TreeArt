import { FallingPiece } from './FallingPiece.js';
import { TreeRingGenerator } from './TreeRingGenerator.js';

export class CutExecutor {
  constructor(branchMaterial) {
    this.branchMaterial = branchMaterial;
    this.treeRingGenerator = new TreeRingGenerator();
    this.cutBranches = new Set();
    this.fallingPieces = [];
  }

  getDescendants(segments, segIndex) {
    const result = [];
    const stack = [segIndex];

    while (stack.length > 0) {
      const idx = stack.pop();
      result.push(idx);
      const seg = segments[idx];
      if (seg?.children) {
        stack.push(...seg.children);
      }
    }

    return result;
  }

  cutBranch(segments, seg, hitX, hitY, t, slashDir, leaves, sceneManager) {
    // Calculate cut thickness
    const cutThickness = seg.thickness + (seg.endThickness - seg.thickness) * t;

    // Get all descendants to mark as cut
    const fallingIndices = [];
    for (const ci of seg.children) {
      fallingIndices.push(...this.getDescendants(segments, ci));
    }

    // Mark descendants as cut
    for (const idx of fallingIndices) {
      this.cutBranches.add(idx);
    }

    // Save current endpoint before truncating
    const prevX2 = seg.x2;
    const prevY2 = seg.y2;
    const prevEndThickness = seg.endThickness;

    // Truncate the segment
    seg.x2 = hitX;
    seg.y2 = hitY;
    seg.endThickness = cutThickness;
    seg.isCut = true;
    const oldChildren = seg.children;
    seg.children = [];

    // Build falling piece segments
    const pieceSegments = [];

    // Remainder of cut segment
    const remainderLen = Math.sqrt(
      (prevX2 - hitX) ** 2 + (prevY2 - hitY) ** 2
    );

    if (remainderLen > 2) {
      pieceSegments.push({
        lx1: 0, ly1: 0,
        lx2: prevX2 - hitX, ly2: prevY2 - hitY,
        thick1: cutThickness, thick2: prevEndThickness,
        depth: seg.depth,
        hasChildren: oldChildren.length > 0
      });
    }

    // Add descendant segments
    for (const idx of fallingIndices) {
      const s = segments[idx];
      pieceSegments.push({
        lx1: s.x1 - hitX, ly1: s.y1 - hitY,
        lx2: s.x2 - hitX, ly2: s.y2 - hitY,
        thick1: s.thickness, thick2: s.endThickness,
        depth: s.depth,
        hasChildren: s.children.length > 0
      });
    }

    // Collect leaves attached to falling segments
    const allFallingIndices = new Set(fallingIndices);
    allFallingIndices.add(seg.index);
    const pieceLeaves = [];

    for (let li = leaves.length - 1; li >= 0; li--) {
      const leaf = leaves[li];

      if (leaf.segIndex === seg.index) {
        // Only take leaves beyond cut point
        if (leaf.t > t) {
          pieceLeaves.push({
            lx: leaf.x - hitX,
            ly: leaf.y - hitY,
            bx: leaf.bx - hitX,
            by: leaf.by - hitY,
            size: leaf.size,
            angle: leaf.angle,
            color: leaf.color
          });
          leaves.splice(li, 1);
        }
      } else if (allFallingIndices.has(leaf.segIndex)) {
        pieceLeaves.push({
          lx: leaf.x - hitX,
          ly: leaf.y - hitY,
          bx: leaf.bx - hitX,
          by: leaf.by - hitY,
          size: leaf.size,
          angle: leaf.angle,
          color: leaf.color
        });
        leaves.splice(li, 1);
      }
    }

    // Create tree ring at cut point
    const treeRing = this.treeRingGenerator.createCutCap(
      { x: hitX, y: hitY },
      cutThickness,
      seg.angle,
      seg.depth
    );
    sceneManager.layers.treeRings.add(treeRing);

    // Create falling piece
    if (pieceSegments.length > 0) {
      const piece = new FallingPiece({
        x: hitX, y: hitY,
        vx: slashDir * (1.5 + Math.random() * 1.5),
        vy: -1 - Math.random() * 2,
        rotation: 0,
        angularVel: slashDir * (0.015 + Math.random() * 0.03),
        segments: pieceSegments,
        thickness: cutThickness,
        leaves: pieceLeaves,
        treeRings: [treeRing]
      }, this.branchMaterial);

      this.fallingPieces.push(piece);
      sceneManager.layers.fallingPieces.add(piece.mesh);
    }

    return true;
  }

  cutFallingPiece(result, slashDir, sceneManager) {
    const { piece, seg, hitX, hitY, t } = result;

    // Convert hit to world coords
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    const worldHitX = piece.x + hitX * cos - hitY * sin;
    const worldHitY = piece.y + hitX * sin + hitY * cos;

    // Split off new segments
    const newSegments = [];
    const cutThickness = seg.thick1 + (seg.thick2 - seg.thick1) * t;

    // Remainder of cut segment
    const remLx = seg.lx2 - hitX;
    const remLy = seg.ly2 - hitY;

    if (Math.sqrt(remLx * remLx + remLy * remLy) > 2) {
      newSegments.push({
        lx1: 0, ly1: 0,
        lx2: remLx, ly2: remLy,
        thick1: cutThickness, thick2: seg.thick2,
        depth: seg.depth,
        hasChildren: seg.hasChildren
      });
    }

    // Find child segments
    const segEndX = seg.lx2;
    const segEndY = seg.ly2;

    for (let i = 0; i < piece.segments.length; i++) {
      const s = piece.segments[i];
      if (s === seg || s.fallen) continue;

      const dist = Math.sqrt(
        (s.lx1 - segEndX) ** 2 + (s.ly1 - segEndY) ** 2
      );

      if (dist < 5) {
        s.fallen = true;
        newSegments.push({
          lx1: s.lx1 - hitX, ly1: s.ly1 - hitY,
          lx2: s.lx2 - hitX, ly2: s.ly2 - hitY,
          thick1: s.thick1, thick2: s.thick2,
          depth: s.depth,
          hasChildren: s.hasChildren
        });
      }
    }

    // Truncate original segment
    seg.lx2 = hitX;
    seg.ly2 = hitY;
    seg.thick2 = cutThickness;
    seg.hasChildren = false;

    // Rebuild piece geometry
    piece.mesh.geometry.dispose();
    piece.mesh.geometry = piece.buildGeometry();

    // Create tree ring at cut point
    const angle = Math.atan2(seg.ly2 - seg.ly1, seg.lx2 - seg.lx1);
    const treeRing = this.treeRingGenerator.createCutCap(
      { x: worldHitX, y: worldHitY },
      cutThickness,
      angle + piece.rotation,
      seg.depth
    );
    sceneManager.layers.treeRings.add(treeRing);

    // Create new falling piece
    if (newSegments.length > 0) {
      const newPiece = new FallingPiece({
        x: worldHitX, y: worldHitY,
        vx: piece.vx + slashDir * 2,
        vy: piece.vy - 2,
        rotation: piece.rotation,
        angularVel: piece.angularVel + slashDir * 0.05,
        segments: newSegments,
        thickness: cutThickness
      }, this.branchMaterial);

      this.fallingPieces.push(newPiece);
      sceneManager.layers.fallingPieces.add(newPiece.mesh);
    }

    return true;
  }

  update(groundY, onShake) {
    const spawnQueue = [];

    for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
      const piece = this.fallingPieces[i];
      const alive = piece.update(groundY, onShake, (data) => {
        spawnQueue.push(data);
      });

      if (!alive) {
        piece.mesh.parent?.remove(piece.mesh);
        piece.dispose();
        this.fallingPieces.splice(i, 1);
      }
    }

    // Process spawn queue
    for (const data of spawnQueue) {
      const piece = new FallingPiece(data, this.branchMaterial);
      this.fallingPieces.push(piece);
      // Add to scene via callback or reference
    }

    return spawnQueue;
  }

  clear() {
    for (const piece of this.fallingPieces) {
      piece.mesh.parent?.remove(piece.mesh);
      piece.dispose();
    }
    this.fallingPieces = [];
    this.cutBranches.clear();
    this.treeRingGenerator.clear();
  }
}
