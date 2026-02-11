varying vec2 vUv;
varying vec3 vColor;
varying float vScale;

uniform float time;

void main() {
  vec3 leafColor = vColor;

  // Center vein (vertical line down the middle)
  float centerVein = 1.0 - smoothstep(0.0, 0.025, abs(vUv.x - 0.5));

  // Side veins radiating from center
  vec2 centered = vUv - vec2(0.5, 0.3);
  float angle = atan(centered.x, centered.y);
  float sideVeins = sin(angle * 8.0) * 0.5 + 0.5;
  sideVeins = smoothstep(0.7, 0.9, sideVeins) * (1.0 - smoothstep(0.0, 0.4, length(centered)));

  // Darken along veins
  float veinDarkening = (centerVein + sideVeins * 0.6) * 0.12;
  leafColor *= 1.0 - veinDarkening;

  // Cel-shading: quantize to bands
  leafColor = floor(leafColor * 5.0 + 0.5) / 5.0;

  // Slight edge darkening
  float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float edgeFactor = smoothstep(0.0, 0.15, edgeDist);
  leafColor *= 0.9 + edgeFactor * 0.1;

  // Alpha for smooth edges and growth animation
  float alpha = smoothstep(0.0, 0.05, edgeDist) * vScale;

  // Discard fully transparent pixels
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(leafColor, alpha);
}
