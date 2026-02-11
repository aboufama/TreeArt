uniform float time;

attribute vec3 instanceColor;
attribute float instanceScale;
attribute float instanceWindPhase;

varying vec2 vUv;
varying vec3 vColor;
varying float vScale;

void main() {
  vUv = uv;
  vColor = instanceColor;
  vScale = instanceScale;

  // Apply instance transform from instanceMatrix
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);

  gl_Position = projectionMatrix * mvPosition;
}
