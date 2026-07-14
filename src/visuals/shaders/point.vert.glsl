attribute vec3 color;
varying vec3 vColor;
varying float vAlpha;
uniform float pointSize;
uniform float time;
uniform float alphaMultiplier;
void main() {
  float twinkle = 0.85 + 0.3 * sin(time);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.5, pointSize * (400.0 / -mvPosition.z) * twinkle);
  gl_Position = projectionMatrix * mvPosition;
  vColor = color;
  vAlpha = alphaMultiplier;
}
