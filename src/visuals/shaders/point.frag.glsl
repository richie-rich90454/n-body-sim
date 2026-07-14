varying vec3 vColor;
varying float vAlpha;
uniform sampler2D spriteTex;
void main() {
  vec4 texColor = texture2D(spriteTex, gl_PointCoord);
  float alpha = texColor.a * vAlpha;
  gl_FragColor = vec4(vColor * texColor.rgb, alpha);
}
