import * as THREE from 'three';
import { getBranchColor } from '../utils/ColorUtils.js';

const MAX_DEPTH = 9;

export class BranchGeometry {
  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.positions = [];
    this.uvs = [];
    this.depthRatios = [];
    this.colors = [];
    this.indices = [];
  }

  build(segments, cutBranches = new Set(), getSegmentGrowth = null) {
    this.positions = [];
    this.uvs = [];
    this.depthRatios = [];
    this.colors = [];
    this.indices = [];

    let vertexIndex = 0;

    for (const seg of segments) {
      if (cutBranches.has(seg.index)) continue;

      // Get growth fraction for this segment (0 = hidden, 0-1 = partial, 1 = full)
      let growth = 1;
      if (getSegmentGrowth) {
        growth = getSegmentGrowth(seg.depth);
        if (growth <= 0) continue;
      }

      // Get segment vertices (with partial growth interpolation)
      const verts = this.getSegmentVertices(seg, growth);
      if (!verts) continue;

      const { p1, p2, p3, p4, color, depthRatio } = verts;

      // Add 4 vertices for the quad
      this.positions.push(
        p1.x, p1.y, 0,
        p2.x, p2.y, 0,
        p3.x, p3.y, 0,
        p4.x, p4.y, 0
      );

      // UVs - U along branch, V across thickness
      this.uvs.push(
        0, 0,
        1, 0,
        1, 1,
        0, 1
      );

      // Depth ratio for shader
      for (let i = 0; i < 4; i++) {
        this.depthRatios.push(depthRatio);
        this.colors.push(color.r, color.g, color.b);
      }

      // Two triangles: 0-1-2, 0-2-3
      this.indices.push(
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      );
      vertexIndex += 4;
    }

    // Update geometry
    this.geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv',
      new THREE.Float32BufferAttribute(this.uvs, 2));
    this.geometry.setAttribute('depthRatio',
      new THREE.Float32BufferAttribute(this.depthRatios, 1));
    this.geometry.setAttribute('branchColor',
      new THREE.Float32BufferAttribute(this.colors, 3));
    this.geometry.setIndex(this.indices);

    this.geometry.computeBoundingSphere();

    return this.geometry;
  }

  getSegmentVertices(seg, growth = 1) {
    const depthRatio = seg.depth / MAX_DEPTH;
    const color = getBranchColor(seg.depth, MAX_DEPTH);

    // Interpolate end point for partial growth
    const x2 = seg.x1 + (seg.x2 - seg.x1) * growth;
    const y2 = seg.y1 + (seg.y2 - seg.y1) * growth;
    const endThick = seg.thickness + (seg.endThickness - seg.thickness) * growth;

    // Calculate perpendicular for thickness
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    const t1 = seg.thickness / 2;
    const t2 = endThick / 2;

    // Four corners of tapered quad
    const p1 = { x: seg.x1 + perpX * t1, y: seg.y1 + perpY * t1 };
    const p2 = { x: x2 + perpX * t2, y: y2 + perpY * t2 };
    const p3 = { x: x2 - perpX * t2, y: y2 - perpY * t2 };
    const p4 = { x: seg.x1 - perpX * t1, y: seg.y1 - perpY * t1 };

    return { p1, p2, p3, p4, color, depthRatio };
  }

  dispose() {
    this.geometry.dispose();
  }
}
