uniform float rings;
uniform vec3 ringColor;
uniform vec3 gapColor;
uniform vec3 centerColor;
uniform float noiseScale;
uniform float time;

varying vec2 vUv;

// Simple hash function
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Smooth noise
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
  // Distance from center (0 to 1)
  vec2 centered = vUv - 0.5;
  float dist = length(centered) * 2.0;

  // Wobbly rings - add noise to distance
  float angle = atan(centered.y, centered.x);
  float wobble = noise(vec2(angle * 3.0, 0.0)) * noiseScale * 0.15;
  dist += wobble;

  // Ring pattern
  float ringPattern = fract(dist * rings);

  // Create rings with varying widths
  float ringMask = smoothstep(0.25, 0.35, ringPattern) *
                   smoothstep(0.75, 0.65, ringPattern);

  // Color: center -> heartwood, then alternating rings
  vec3 color;
  if (dist < 0.18) {
    // Central heartwood (darker core)
    color = centerColor * 0.9;
  } else {
    // Alternating light/dark rings
    color = mix(gapColor, ringColor, ringMask);
  }

  // Slight radial gradient (outer rings slightly lighter)
  color *= 0.92 + dist * 0.12;

  // Add subtle radial rays/cracks
  float rays = sin(angle * 12.0) * 0.5 + 0.5;
  rays = smoothstep(0.4, 0.6, rays) * 0.08;
  color *= 1.0 - rays * (1.0 - dist * 0.5);

  // Cel-shading
  color = floor(color * 6.0 + 0.5) / 6.0;

  // Edge softening
  float alpha = 1.0 - smoothstep(0.92, 1.0, dist);

  // Discard outside circle
  if (dist > 1.0) discard;

  gl_FragColor = vec4(color, alpha);
}
