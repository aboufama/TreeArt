import * as THREE from 'three';
import { getBranchColor } from '../utils/ColorUtils.js';

const MAX_DEPTH = 9;
const GRAVITY = -0.4;

export class FallingPiece {
  constructor(data, branchMaterial) {
    this.x = data.x;
    this.y = data.y;
    this.vx = data.vx;
    this.vy = data.vy;
    this.rotation = data.rotation || 0;
    this.angularVel = data.angularVel || 0;
    this.segments = data.segments;
    this.thickness = data.thickness;
    this.leaves = data.leaves || [];

    this.ridingLeaves = data.leaves || [];
    this.landed = false;
    this.settled = false;
    this.groundTime = 0;
    this.alpha = 1;
    this.leafAlpha = 1;
    this.pivoting = false;
    this.impactDone = false;
    this.groundShake = false;
    this.leavesShed = false;

    // Create mesh for this piece
    this.mesh = this.createMesh(branchMaterial);
    this.mesh.renderOrder = 3;
  }

  createMesh(branchMaterial) {
    const geometry = this.buildGeometry();
    const mesh = new THREE.Mesh(geometry, branchMaterial);
    return mesh;
  }

  buildGeometry() {
    const positions = [];
    const uvs = [];
    const depthRatios = [];
    const colors = [];
    const indices = [];
    let vertexIndex = 0;

    for (const seg of this.segments) {
      if (seg.fallen) continue;

      const angle = Math.atan2(seg.ly2 - seg.ly1, seg.lx2 - seg.lx1);
      const perpX = Math.cos(angle + Math.PI / 2);
      const perpY = Math.sin(angle + Math.PI / 2);

      const t1 = seg.thick1 / 2;
      const t2 = seg.thick2 / 2;

      const p1 = { x: seg.lx1 + perpX * t1, y: seg.ly1 + perpY * t1 };
      const p2 = { x: seg.lx2 + perpX * t2, y: seg.ly2 + perpY * t2 };
      const p3 = { x: seg.lx2 - perpX * t2, y: seg.ly2 - perpY * t2 };
      const p4 = { x: seg.lx1 - perpX * t1, y: seg.ly1 - perpY * t1 };

      positions.push(
        p1.x, p1.y, 0,
        p2.x, p2.y, 0,
        p3.x, p3.y, 0,
        p4.x, p4.y, 0
      );

      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

      const depthRatio = seg.depth / MAX_DEPTH;
      const color = getBranchColor(seg.depth, MAX_DEPTH);

      for (let i = 0; i < 4; i++) {
        depthRatios.push(depthRatio);
        colors.push(color.r, color.g, color.b);
      }

      indices.push(
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      );
      vertexIndex += 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('depthRatio', new THREE.Float32BufferAttribute(depthRatios, 1));
    geometry.setAttribute('branchColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    return geometry;
  }

  updateMesh() {
    this.mesh.position.set(this.x, this.y, 0.1);
    this.mesh.rotation.z = this.rotation;

    if (this.alpha < 1) {
      this.mesh.material.transparent = true;
      this.mesh.material.opacity = this.alpha;
    }
  }

  getCorners() {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const pts = [];

    for (const seg of this.segments) {
      if (seg.fallen) continue;

      const angle = Math.atan2(seg.ly2 - seg.ly1, seg.lx2 - seg.lx1);
      const perpX = Math.cos(angle + Math.PI / 2);
      const perpY = Math.sin(angle + Math.PI / 2);
      const ht1 = seg.thick1 / 2;
      const ht2 = seg.thick2 / 2;

      const locals = [
        [seg.lx1 + perpX * ht1, seg.ly1 + perpY * ht1],
        [seg.lx2 + perpX * ht2, seg.ly2 + perpY * ht2],
        [seg.lx2 - perpX * ht2, seg.ly2 - perpY * ht2],
        [seg.lx1 - perpX * ht1, seg.ly1 - perpY * ht1]
      ];

      for (const [lx, ly] of locals) {
        pts.push({
          lx, ly,
          wx: this.x + lx * cos - ly * sin,
          wy: this.y + lx * sin + ly * cos
        });
      }
    }

    return { pts, cos, sin };
  }

  getCenterOfMass() {
    let totalMass = 0;
    let cmx = 0;
    let cmy = 0;

    for (const seg of this.segments) {
      if (seg.fallen) continue;

      const mx = (seg.lx1 + seg.lx2) / 2;
      const my = (seg.ly1 + seg.ly2) / 2;
      const len = Math.sqrt(
        (seg.lx2 - seg.lx1) ** 2 + (seg.ly2 - seg.ly1) ** 2
      );
      const mass = len * ((seg.thick1 + seg.thick2) / 2);

      cmx += mx * mass;
      cmy += my * mass;
      totalMass += mass;
    }

    if (totalMass > 0) {
      cmx /= totalMass;
      cmy /= totalMass;
    }

    return { x: cmx, y: cmy, mass: totalMass || 1 };
  }

  // Returns riding leaves in world coordinates for rendering
  getWorldLeaves() {
    if (this.ridingLeaves.length === 0) return [];

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const result = [];

    for (const leaf of this.ridingLeaves) {
      result.push({
        x: this.x + leaf.lx * cos - leaf.ly * sin,
        y: this.y + leaf.lx * sin + leaf.ly * cos,
        size: leaf.size,
        angle: leaf.angle + this.rotation,
        color: leaf.color,
        life: this.leafAlpha
      });
    }

    return result;
  }

  // Shed 30% of riding leaves on ground impact, returns shed leaves for detached physics
  shedLeavesOnImpact() {
    if (this.leavesShed || this.ridingLeaves.length === 0) return [];

    this.leavesShed = true;
    const shed = [];
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    for (let i = this.ridingLeaves.length - 1; i >= 0; i--) {
      if (Math.random() < 0.06) {
        const leaf = this.ridingLeaves[i];
        shed.push({
          x: this.x + leaf.lx * cos - leaf.ly * sin,
          y: this.y + leaf.lx * sin + leaf.ly * cos,
          vx: (Math.random() - 0.5) * 2,
          vy: 0.5 + Math.random() * 1,
          size: leaf.size,
          angle: leaf.angle + this.rotation,
          angularVel: (Math.random() - 0.5) * 0.08,
          color: leaf.color,
          life: 1,
          flutter: Math.random() * Math.PI * 2,
          flutterSpeed: 0.03 + Math.random() * 0.03
        });
        this.ridingLeaves.splice(i, 1);
      }
    }

    return shed;
  }

  update(groundY, onShake, onSpawnPiece) {
    // Settled pieces: fade leaves first, then branch
    if (this.settled) {
      this.groundTime++;
      // Leaves start fading immediately after settling
      if (this.groundTime > 30) {
        this.leafAlpha = Math.max(0, this.leafAlpha - 0.005);
      }
      // Branch starts fading only after leaves are gone
      if (this.leafAlpha <= 0 && this.groundTime > 90) {
        this.alpha = Math.max(0, this.alpha - 0.01);
      }
      this.updateMesh();
      return this.alpha > 0;
    }

    // Movement
    if (this.pivoting) {
      // Position controlled by pivot math below
    } else {
      // Airborne: standard physics
      this.vy += GRAVITY;
      this.x += this.vx;
      this.y += this.vy;
      this.rotation += this.angularVel;
      this.angularVel *= 0.998;
    }

    // Compute corners
    const { pts: corners, cos, sin } = this.getCorners();
    if (corners.length === 0) {
      this.updateMesh();
      return true;
    }

    // Find lowest point
    let minWY = Infinity;
    let contactCorner = null;
    for (const c of corners) {
      if (c.wy < minWY) {
        minWY = c.wy;
        contactCorner = c;
      }
    }

    // Still airborne
    if (minWY > groundY) {
      this.pivoting = false;
      this.updateMesh();
      return true;
    }

    // Ground contact
    this.y += (groundY - minWY);

    // Shed branches on first ground contact
    if (!this.impactDone && this.segments.length > 1 && onSpawnPiece) {
      this.impactDone = true;
      let dropped = 0;
      const maxDrop = 2 + Math.floor(Math.random() * 3);

      for (let j = this.segments.length - 1; j >= 0 && dropped < maxDrop; j--) {
        const seg = this.segments[j];
        if (!seg.fallen && seg.depth >= 3) {
          seg.fallen = true;
          dropped++;

          const wx = this.x + seg.lx1 * cos - seg.ly1 * sin;
          const wy = this.y + seg.lx1 * sin + seg.ly1 * cos;

          // Create shed piece
          onSpawnPiece({
            x: wx, y: wy,
            vx: (Math.random() - 0.5) * 4,
            vy: 3 + Math.random() * 3,
            rotation: this.rotation,
            angularVel: (Math.random() - 0.5) * 0.15,
            segments: [{
              lx1: 0, ly1: 0,
              lx2: seg.lx2 - seg.lx1,
              ly2: seg.ly2 - seg.ly1,
              thick1: seg.thick1,
              thick2: seg.thick2,
              depth: seg.depth,
              hasChildren: false
            }],
            thickness: seg.thick1
          });
        }
      }

      // Rebuild geometry after shedding
      this.mesh.geometry.dispose();
      this.mesh.geometry = this.buildGeometry();
    }

    // Bounce if arriving fast
    if (!this.pivoting && this.vy < -3) {
      this.vy *= -0.25;
      this.vx *= 0.6;
      this.angularVel *= 0.5;
      if (this.thickness >= 8 && onShake) {
        onShake(Math.min(4, this.thickness / 6));
      }
      this.updateMesh();
      return true;
    }

    // Pivot/topple physics
    this.vy = 0;
    this.pivoting = true;

    if (!this.groundShake && onShake && this.thickness >= 8) {
      this.groundShake = true;
      onShake(Math.min(3, this.thickness / 7));
    }

    const c2 = Math.cos(this.rotation);
    const s2 = Math.sin(this.rotation);

    // Find ground contact points
    const gThresh = 5;
    let touchLeft = Infinity;
    let touchRight = -Infinity;

    for (const c of corners) {
      const wy = this.y + c.lx * s2 + c.ly * c2;
      if (wy <= groundY + gThresh) {
        const wx = this.x + c.lx * c2 - c.ly * s2;
        touchLeft = Math.min(touchLeft, wx);
        touchRight = Math.max(touchRight, wx);
      }
    }

    // Center of mass
    const com = this.getCenterOfMass();
    const comWX = this.x + com.x * c2 - com.y * s2;

    const supportWidth = touchRight - touchLeft;
    const isStable = supportWidth > 8 && comWX >= touchLeft && comWX <= touchRight;

    if (isStable) {
      // Piece is stable - damp to stop
      this.angularVel *= 0.8;
      this.vx *= 0.85;

      if (Math.abs(this.angularVel) < 0.001 && Math.abs(this.vx) < 0.15) {
        this.settled = true;
        this.landed = true;
        this.angularVel = 0;
        this.vx = 0;
      }
    } else {
      // Topple
      const cpWX = this.x + contactCorner.lx * c2 - contactCorner.ly * s2;
      const leverX = comWX - cpWX;

      // Moment of inertia
      let momentI = 0;
      for (const seg of this.segments) {
        if (seg.fallen) continue;
        const cx = (seg.lx1 + seg.lx2) / 2;
        const cy = (seg.ly1 + seg.ly2) / 2;
        const dx = cx - contactCorner.lx;
        const dy = cy - contactCorner.ly;
        const r2 = dx * dx + dy * dy;
        const len = Math.sqrt(
          (seg.lx2 - seg.lx1) ** 2 + (seg.ly2 - seg.ly1) ** 2
        );
        const mass = len * ((seg.thick1 + seg.thick2) / 2);
        momentI += mass * (r2 + len * len / 12);
      }
      momentI = Math.max(momentI, 500);

      const torque = leverX * GRAVITY * com.mass;
      this.angularVel += torque / momentI;
      this.angularVel *= 0.97;

      // Pin contact corner to ground
      const pinX = cpWX;
      this.rotation += this.angularVel;
      const nc = Math.cos(this.rotation);
      const ns = Math.sin(this.rotation);
      this.x = pinX - (contactCorner.lx * nc - contactCorner.ly * ns);
      this.y = groundY - (contactCorner.lx * ns + contactCorner.ly * nc);

      this.vx *= 0.92;
    }

    this.updateMesh();
    return true;
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}
