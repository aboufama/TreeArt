import * as THREE from 'three';

// Color constants matching original
export const COLORS = {
  background: 0xFAF6F1,
  trunk: '#6B5344',
  tip: '#C4856A',

  // Autumn leaf palette (bright, vivid)
  autumn: [
    '#E63946', '#D94040', '#CC3333',           // bright reds
    '#FF6B35', '#E8762B', '#F28C28',           // vivid oranges
    '#FFD166', '#F0C040', '#E6A820',           // bright golds
    '#FFAB40', '#F59E2A', '#E87D3E',           // warm amber
  ],

  // Rare green holdouts
  green: ['#8DB600', '#7CB518'],

  // Sawdust colors
  sawdust: ['#C4A574', '#A08060'],

  // Tree ring colors
  ringLight: '#8B7355',
  ringDark: '#5C4033',
  heartwood: '#6B5344'
};

// Convert hex string to THREE.Color
export function hexToColor(hex) {
  return new THREE.Color(hex);
}

// Lerp between two hex colors
export function lerpColor(c1, c2, t) {
  const color1 = new THREE.Color(c1);
  const color2 = new THREE.Color(c2);
  return color1.lerp(color2, t);
}

// Get color for branch based on depth
export function getBranchColor(depth, maxDepth = 9) {
  const t = depth / maxDepth;
  return lerpColor(COLORS.trunk, COLORS.tip, t);
}

// Pick a random leaf color (8% chance of green)
export function pickLeafColor(rng) {
  if (rng.chance(0.08)) {
    return rng.pick(COLORS.green);
  }
  return rng.pick(COLORS.autumn);
}

// Convert THREE.Color to shader-friendly vec3 array
export function colorToVec3(color) {
  if (typeof color === 'string') {
    color = new THREE.Color(color);
  }
  return [color.r, color.g, color.b];
}

// Parse hex to RGB components (0-255)
export function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// RGB to hex
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}
