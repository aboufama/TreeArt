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

  build(segments, cutBranches = new Set(), growthProgress = 1) {
    this.positions = [];
    this.uvs = [];
    this.depthRatios = [];
    this.colors = [];
    this.indices = [];

    let vertexIndex = 0;

    for (const seg of segments) {
      if (cutBranches.has(seg.index)) continue;

      // Get segment vertices
      const verts = this.getSegmentVertices(seg, growthProgress);
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

      // Add end cap circle if branch has children or is cut
      if (!seg.isCut && seg.children.length > 0) {
        const capVerts = this.addEndCap(seg.x2, seg.y2, seg.endThickness / 2, color, depthRatio);
        vertexIndex += capVerts;
      }
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

  getSegmentVertices(seg, growthProgress = 1) {
    const depthRatio = seg.depth / MAX_DEPTH;
    const color = getBranchColor(seg.depth, MAX_DEPTH);

    // Calculate perpendicular for thickness
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    const t1 = seg.thickness / 2;
    const t2 = seg.endThickness / 2;

    // Four corners of tapered quad
    const p1 = { x: seg.x1 + perpX * t1, y: seg.y1 + perpY * t1 };
    const p2 = { x: seg.x2 + perpX * t2, y: seg.y2 + perpY * t2 };
    const p3 = { x: seg.x2 - perpX * t2, y: seg.y2 - perpY * t2 };
    const p4 = { x: seg.x1 - perpX * t1, y: seg.y1 - perpY * t1 };

    return { p1, p2, p3, p4, color, depthRatio };
  }

  addEndCap(cx, cy, radius, color, depthRatio) {
    const segments = 12;
    const startVertex = this.positions.length / 3;

    // Center vertex
    this.positions.push(cx, cy, 0);
    this.uvs.push(0.5, 0.5);
    this.depthRatios.push(depthRatio);
    this.colors.push(color.r, color.g, color.b);

    // Circle vertices
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = cx + Math.cos(theta) * radius;
      const y = cy + Math.sin(theta) * radius;

      this.positions.push(x, y, 0);
      this.uvs.push(0.5 + Math.cos(theta) * 0.5, 0.5 + Math.sin(theta) * 0.5);
      this.depthRatios.push(depthRatio);
      this.colors.push(color.r, color.g, color.b);
    }

    // Triangle fan indices
    for (let i = 0; i < segments; i++) {
      this.indices.push(
        startVertex,
        startVertex + 1 + i,
        startVertex + 1 + i + 1
      );
    }

    return segments + 2; // center + circle vertices
  }

  dispose() {
    this.geometry.dispose();
  }
}
