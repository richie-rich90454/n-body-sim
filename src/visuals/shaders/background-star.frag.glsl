varying vec3 vColor;
uniform sampler2D spriteTex;
void main() {
    vec4 tex = texture2D(spriteTex, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * 0.8);
}
