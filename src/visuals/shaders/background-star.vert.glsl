attribute vec3 color;
varying vec3 vColor;
uniform float pointSize;
void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.5, pointSize * (300.0 / -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
    vColor = color;
}