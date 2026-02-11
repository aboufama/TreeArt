varying vec2 vUv;
varying float vDepthRatio;
varying vec3 vColor;

attribute float depthRatio;
attribute vec3 branchColor;

void main() {
  vUv = uv;
  vDepthRatio = depthRatio;
  vColor = branchColor;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
