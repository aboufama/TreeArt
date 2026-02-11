varying vec2 vUv;
varying float vDepthRatio;
varying vec3 vColor;

uniform float time;

// Simple noise for bark texture
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec3 color = vColor;

  // Subtle bark texture using noise
  float barkNoise = noise(vUv * 8.0 + vDepthRatio * 2.0);
  color *= 0.92 + barkNoise * 0.16;

  // Cel-shading: Quantize color to create bands
  color = floor(color * 5.0 + 0.5) / 5.0;

  // Edge darkening for hand-drawn look
  float edgeFactor = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  color *= 0.88 + edgeFactor * 0.12;

  // Slight warmth adjustment
  color.r *= 1.02;
  color.b *= 0.98;

  gl_FragColor = vec4(color, 1.0);
}
