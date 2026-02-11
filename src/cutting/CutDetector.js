export class CutDetector {
  constructor() {
    this.segments = [];
    this.fallingPieces = [];
  }

  setSegments(segments) {
    this.segments = segments;
  }

  setFallingPieces(pieces) {
    this.fallingPieces = pieces;
  }

  // Line segment intersection test
  lineIntersects(x1, y1, x2, y2, x3, y3, x4, y4) {
    const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(d) < 0.0001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
        t: u
      };
    }
    return null;
  }

  findIntersectingBranch(sx1, sy1, sx2, sy2, cutBranches) {
    let best = null;
    let bestDist = Infinity;

    for (const seg of this.segments) {
      if (cutBranches.has(seg.index)) continue;
      if (seg.isCut) continue;

      const hit = this.lineIntersects(
        sx1, sy1, sx2, sy2,
        seg.x1, seg.y1, seg.x2, seg.y2
      );

      if (hit) {
        // Prevent cutting trunk too close to base
        if (seg.depth <= 1) {
          const segLen = Math.sqrt(
            (seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2
          );
          if (hit.t * segLen < seg.thickness) continue;
        }

        const dist = (hit.x - sx1) ** 2 + (hit.y - sy1) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = { seg, hitX: hit.x, hitY: hit.y, t: hit.t };
        }
      }
    }

    return best;
  }

  findIntersectingFallingPiece(sx1, sy1, sx2, sy2) {
    for (let pi = 0; pi < this.fallingPieces.length; pi++) {
      const piece = this.fallingPieces[pi];
      const cos = Math.cos(piece.rotation);
      const sin = Math.sin(piece.rotation);

      // Transform slash to piece's local coords
      const lsx1 = (sx1 - piece.x) * cos + (sy1 - piece.y) * sin;
      const lsy1 = -(sx1 - piece.x) * sin + (sy1 - piece.y) * cos;
      const lsx2 = (sx2 - piece.x) * cos + (sy2 - piece.y) * sin;
      const lsy2 = -(sx2 - piece.x) * sin + (sy2 - piece.y) * cos;

      for (let si = 0; si < piece.segments.length; si++) {
        const seg = piece.segments[si];
        if (seg.fallen) continue;

        const hit = this.lineIntersects(
          lsx1, lsy1, lsx2, lsy2,
          seg.lx1, seg.ly1, seg.lx2, seg.ly2
        );

        if (hit) {
          return {
            piece,
            pieceIndex: pi,
            seg,
            segIndex: si,
            hitX: hit.x,
            hitY: hit.y,
            t: hit.t
          };
        }
      }
    }
    return null;
  }
}
