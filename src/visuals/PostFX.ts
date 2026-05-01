import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { WebGLRenderer, Scene, PerspectiveCamera, Vector2, ShaderMaterial } from "three";

const lensingVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const lensingFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uBlackHoleScreenPos;
  uniform float uStrength;
  uniform float uAspect;
  void main() {
    vec2 uv = vUv;
    vec2 delta = uv - uBlackHoleScreenPos;
    delta.x *= uAspect;
    float dist = length(delta);
    if (dist < 0.001) { gl_FragColor = texture2D(tDiffuse, uv); return; }
    float factor = uStrength / (dist * dist + 0.0001);
    factor = min(factor, 0.1);
    vec2 offset = delta * factor;
    offset.x /= uAspect;
    vec2 sampleUV = uv - offset;
    gl_FragColor = texture2D(tDiffuse, sampleUV);
  }
`;

export class PostFX {
	public composer: EffectComposer;
	public bloomPass: UnrealBloomPass;
	private lensingPass: ShaderPass;
	private lensingUniforms: any;

	constructor(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
		this.composer = new EffectComposer(renderer);
		const renderPass = new RenderPass(scene, camera);
		this.composer.addPass(renderPass);

		this.bloomPass = new UnrealBloomPass(
			new Vector2(window.innerWidth, window.innerHeight),
			1.5,
			0.4,
			0.85,
		);
		this.bloomPass.threshold = 0.5;
		this.bloomPass.strength = 1.5;
		this.bloomPass.radius = 0.8;
		this.composer.addPass(this.bloomPass);

		this.lensingUniforms = {
			tDiffuse: { value: null },
			uBlackHoleScreenPos: { value: new Vector2(0.5, 0.5) },
			uStrength: { value: 0.015 },
			uAspect: { value: window.innerWidth / window.innerHeight },
		};
		const lensingMat = new ShaderMaterial({
			uniforms: this.lensingUniforms,
			vertexShader: lensingVertexShader,
			fragmentShader: lensingFragmentShader,
		});
		this.lensingPass = new ShaderPass(lensingMat);
		this.lensingPass.renderToScreen = true;
		this.composer.addPass(this.lensingPass);
	}

	public setBloomIntensity(value: number) {
		this.bloomPass.strength = value;
	}

	public setLensingScreenPos(screenPos: Vector2, blackHoleRadius: number = 1.0) {
		this.lensingUniforms.uBlackHoleScreenPos.value.copy(screenPos);
		this.lensingUniforms.uStrength.value = 0.008 * blackHoleRadius;
		this.lensingUniforms.uAspect.value = window.innerWidth / window.innerHeight;
	}

	public setSize(width: number, height: number) {
		this.composer.setSize(width, height);
		this.lensingUniforms.uAspect.value = width / height;
	}

	public render() {
		this.composer.render();
	}
}
