import chroma from "chroma-js";
import {
	Points,
	BufferGeometry,
	BufferAttribute,
	ShaderMaterial,
	AdditiveBlending,
	Sprite,
	SpriteMaterial,
	CanvasTexture,
	Vector3,
	Color,
} from "three";
import { STRIDE } from "../math/PhysicsEngine";

function buildLUT(scale: chroma.Scale, steps: number): Float32Array {
	const arr = new Float32Array(steps * 3);
	for (let i = 0; i < steps; i++) {
		const [r, g, b] = scale(i / (steps - 1)).rgb();
		arr[i * 3] = r / 255;
		arr[i * 3 + 1] = g / 255;
		arr[i * 3 + 2] = b / 255;
	}
	return arr;
}

const CORE_LUT = buildLUT(chroma.scale(["#ffffff", "#ffdd88", "#ff9933"]).mode("lch"), 256);
const ARM_LUT = buildLUT(chroma.scale(["#ffeedd", "#cce0ff", "#88aaff"]).mode("lch"), 256);
const SPEED_LUT = buildLUT(chroma.scale(["#6688cc", "#ffffff"]).mode("lch"), 256);
const DOPPLER_LUT = buildLUT(chroma.scale(["#aaccff", "#ffffff", "#ffaa88"]).mode("lch"), 256);

export class ParticleSystem {
	public points: Points;
	public bulgePoints: Points;
	public dustPoints: Points;
	public haloPoints: Points;
	public backgroundStars: Points | null = null;
	private geometry: BufferGeometry;
	private bulgeGeometry: BufferGeometry;
	private dustGeometry: BufferGeometry;
	private haloGeometry: BufferGeometry;
	private backgroundGeometry: BufferGeometry;
	private count: number;
	private bulgeCount: number;
	private dustCount: number;
	private haloCount: number;
	private positionArray: Float32Array;
	private colorArray: Float32Array;
	private sizeSeedArray: Float32Array;
	private bulgePositionArray: Float32Array;
	private bulgeColorArray: Float32Array;
	private dustPositionArray: Float32Array;
	private dustColorArray: Float32Array;
	private haloPositionArray: Float32Array;
	private haloColorArray: Float32Array;
	public blackHoleSprite: Sprite | null = null;
	private speeds: Float32Array;
	private lastPointSize = 1.8;
	private time = 0;
	private bulgeMap: Uint32Array;
	private dustMap: Uint32Array;
	private haloMap: Uint32Array;
	private accretionScale = chroma
		.scale(["white", "yellow", "orange", "red", "darkred", "black"])
		.mode("lch");
	private staticLayersInitialized = false;

	constructor(count: number) {
		this.count = count;
		this.bulgeCount = Math.floor(count * 0.12);
		this.dustCount = Math.floor(count * 0.18);
		this.haloCount = count * 2;
		this.bulgeMap = new Uint32Array(this.bulgeCount);
		this.dustMap = new Uint32Array(this.dustCount);
		this.haloMap = new Uint32Array(this.haloCount);
		for (let i = 0; i < this.bulgeCount; i++)
			this.bulgeMap[i] = Math.floor(Math.random() * count);
		for (let i = 0; i < this.dustCount; i++)
			this.dustMap[i] = Math.floor(Math.random() * count);
		for (let i = 0; i < this.haloCount; i++)
			this.haloMap[i] = Math.floor(Math.random() * count);
		this.geometry = new BufferGeometry();
		this.bulgeGeometry = new BufferGeometry();
		this.dustGeometry = new BufferGeometry();
		this.haloGeometry = new BufferGeometry();
		this.backgroundGeometry = new BufferGeometry();
		this.positionArray = new Float32Array(count * 3);
		this.colorArray = new Float32Array(count * 3);
		this.sizeSeedArray = new Float32Array(count);
		for (let i = 0; i < count; i++) this.sizeSeedArray[i] = Math.random();
		this.bulgePositionArray = new Float32Array(this.bulgeCount * 3);
		this.bulgeColorArray = new Float32Array(this.bulgeCount * 3);
		this.dustPositionArray = new Float32Array(this.dustCount * 3);
		this.dustColorArray = new Float32Array(this.dustCount * 3);
		this.haloPositionArray = new Float32Array(this.haloCount * 3);
		this.haloColorArray = new Float32Array(this.haloCount * 3);
		this.speeds = new Float32Array(count);
		this.geometry.setAttribute("position", new BufferAttribute(this.positionArray, 3));
		this.geometry.setAttribute("color", new BufferAttribute(this.colorArray, 3));
		this.geometry.setAttribute("sizeSeed", new BufferAttribute(this.sizeSeedArray, 1));
		this.bulgeGeometry.setAttribute(
			"position",
			new BufferAttribute(this.bulgePositionArray, 3),
		);
		this.bulgeGeometry.setAttribute("color", new BufferAttribute(this.bulgeColorArray, 3));
		this.dustGeometry.setAttribute("position", new BufferAttribute(this.dustPositionArray, 3));
		this.dustGeometry.setAttribute("color", new BufferAttribute(this.dustColorArray, 3));
		this.haloGeometry.setAttribute("position", new BufferAttribute(this.haloPositionArray, 3));
		this.haloGeometry.setAttribute("color", new BufferAttribute(this.haloColorArray, 3));
		const mainMaterial = this.createMainMaterial();
		const bulgeMaterial = this.createBulgeMaterial();
		const dustMaterial = this.createDustMaterial();
		const haloMaterial = this.createHaloMaterial();
		this.points = new Points(this.geometry, mainMaterial);
		this.bulgePoints = new Points(this.bulgeGeometry, bulgeMaterial);
		this.dustPoints = new Points(this.dustGeometry, dustMaterial);
		this.haloPoints = new Points(this.haloGeometry, haloMaterial);
		this.createBlackHoleSprite();
		this.initializeStaticLayers();
		this.createBackgroundStars();
	}

	private createMainMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: { pointSize: { value: 1.8 }, time: { value: 0 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        uniform float time;
        void main() {
          float twinkle = 0.85 + 0.3 * sin(time);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (400.0 / -mvPosition.z) * twinkle;
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
        }
      `,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float r = length(center);
          if (r > 0.5) discard;
          float alpha = pow(1.0 - r * 1.6, 0.8);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
	}

	private createBulgeMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: { pointSize: { value: 3.2 }, time: { value: 0 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        uniform float time;
        void main() {
          float twinkle = 0.9 + 0.2 * sin(time * 1.5);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (400.0 / -mvPosition.z) * twinkle;
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
        }
      `,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float r = length(center);
          if (r > 0.5) discard;
          float glow = exp(-r * 2.5) * 1.3;
          vec3 warmColor = vColor * (0.9 + 0.3 * sin(gl_PointCoord.x * 3.14159));
          gl_FragColor = vec4(warmColor * glow, glow * 0.8);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
	}

	private createDustMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: { pointSize: { value: 3.0 }, time: { value: 0 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        uniform float time;
        void main() {
          float twinkle = 0.8 + 0.3 * sin(time * 2.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (400.0 / -mvPosition.z) * twinkle;
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
        }
      `,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float r = length(center);
          if (r > 0.5) discard;
          float alpha = (1.0 - r * 1.3) * 0.85;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
	}

	private createHaloMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: { pointSize: { value: 1.1 }, time: { value: 0 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        uniform float time;
        void main() {
          float twinkle = 0.9 + 0.15 * sin(time * 1.2);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (400.0 / -mvPosition.z) * twinkle;
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
        }
      `,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float r = length(center);
          if (r > 0.5) discard;
          float alpha = (1.0 - r * 1.7) * 0.28;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
	}

	private createBackgroundStars() {
		const starCount = 4000;
		const radius = 800;
		const positions = new Float32Array(starCount * 3);
		const colors = new Float32Array(starCount * 3);
		for (let i = 0; i < starCount; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const r = radius * (0.7 + Math.random() * 0.3);
			positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = r * Math.cos(phi);
			const [R, G, B] = [1, 0.9 + Math.random() * 0.1, 0.8 + Math.random() * 0.2];
			colors[i * 3] = R;
			colors[i * 3 + 1] = G;
			colors[i * 3 + 2] = B;
		}
		this.backgroundGeometry.setAttribute("position", new BufferAttribute(positions, 3));
		this.backgroundGeometry.setAttribute("color", new BufferAttribute(colors, 3));
		const starMaterial = new ShaderMaterial({
			uniforms: { pointSize: { value: 0.6 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
        }
      `,
			fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float r = length(center);
          if (r > 0.5) discard;
          float alpha = (1.0 - r) * 0.8;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
		this.backgroundStars = new Points(this.backgroundGeometry, starMaterial);
	}

	private createBlackHoleSprite() {
		const size = 512;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d")!;
		const centerX = size / 2,
			centerY = size / 2;
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, size, size);
		const imageData = ctx.createImageData(size, size);
		const data = imageData.data;
		const voidRadius = 40,
			innerRadius = 50,
			outerRadius = 120;
		for (let py = 0; py < size; py++) {
			for (let px = 0; px < size; px++) {
				const dx = px - centerX,
					dy = py - centerY;
				const r = Math.sqrt(dx * dx + dy * dy);
				if (r < voidRadius || r > outerRadius + 15) continue;
				const t = Math.max(0, Math.min(1, (r - innerRadius) / (outerRadius - innerRadius)));
				let intensity = 0;
				if (r >= innerRadius && r <= outerRadius) {
					intensity = Math.sin(t * Math.PI) * 1.0;
				} else if (r > voidRadius && r < innerRadius) {
					intensity = Math.pow((r - voidRadius) / (innerRadius - voidRadius), 1.5) * 0.5;
				} else if (r > outerRadius) {
					intensity = (1 - (r - outerRadius) / 18) * 0.4;
				}
				if (intensity <= 0.01) continue;
				const verticalBias = 0.6 + 0.5 * (dy / r);
				const asymmetry = Math.max(0.3, Math.min(1.3, verticalBias));
				intensity *= asymmetry;
				const horizontalBias = 0.9 + 0.2 * (dx / r);
				intensity *= horizontalBias;
				const colourFactor = Math.max(0, Math.min(1, (dy / r) * 0.7 + 0.5));
				const col = this.accretionScale(colourFactor).rgb();
				const alpha = Math.floor(intensity * 220);
				const idx = (py * size + px) * 4;
				data[idx] = col[0];
				data[idx + 1] = col[1];
				data[idx + 2] = col[2];
				data[idx + 3] = alpha;
			}
		}
		ctx.putImageData(imageData, 0, 0);
		const outerGlow = ctx.createRadialGradient(
			centerX,
			centerY,
			innerRadius,
			centerX,
			centerY,
			outerRadius + 35,
		);
		outerGlow.addColorStop(0, "rgba(255,140,40,0.25)");
		outerGlow.addColorStop(1, "rgba(80,30,10,0)");
		ctx.fillStyle = outerGlow;
		ctx.beginPath();
		ctx.arc(centerX, centerY, outerRadius + 35, 0, Math.PI * 2);
		ctx.fill();
		const texture = new CanvasTexture(canvas);
		const material = new SpriteMaterial({
			map: texture,
			blending: AdditiveBlending,
			depthWrite: false,
		});
		this.blackHoleSprite = new Sprite(material);
		this.blackHoleSprite.scale.set(180, 180, 1);
		this.blackHoleSprite.visible = false;
	}

	private initializeStaticLayers() {
		if (this.staticLayersInitialized) return;
		this.staticLayersInitialized = true;
		const bulgePos = this.bulgeGeometry.attributes.position.array as Float32Array;
		const bulgeCol = this.bulgeGeometry.attributes.color.array as Float32Array;
		const dustPos = this.dustGeometry.attributes.position.array as Float32Array;
		const dustCol = this.dustGeometry.attributes.color.array as Float32Array;
		const haloPos = this.haloGeometry.attributes.position.array as Float32Array;
		const haloCol = this.haloGeometry.attributes.color.array as Float32Array;
		const bulgeColorScale = chroma.scale(["#fff5cc", "#ffcc66", "#ff9933"]).mode("lch");
		const dustColorScale = chroma.scale(["#996644", "#664422", "#332211"]).mode("lab");
		const haloColorScale = chroma.scale(["#cce0ff", "#88aaff"]).mode("lab");
		for (let i = 0; i < this.bulgeCount; i++) {
			const r = Math.pow(Math.random(), 1.6) * 65;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			bulgePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			bulgePos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
			bulgePos[i * 3 + 2] = r * Math.cos(phi) * 0.7;
			const col = bulgeColorScale(r / 65).rgb();
			bulgeCol[i * 3] = col[0] / 255;
			bulgeCol[i * 3 + 1] = col[1] / 255;
			bulgeCol[i * 3 + 2] = col[2] / 255;
		}
		for (let i = 0; i < this.dustCount; i++) {
			const r = 40 + Math.pow(Math.random(), 2.0) * 240;
			const theta = Math.random() * Math.PI * 2;
			dustPos[i * 3] = r * Math.cos(theta);
			dustPos[i * 3 + 1] = (Math.random() - 0.5) * 28;
			dustPos[i * 3 + 2] = r * Math.sin(theta) * 0.35;
			const col = dustColorScale(0.3 + 0.7 * Math.random()).rgb();
			dustCol[i * 3] = col[0] / 255;
			dustCol[i * 3 + 1] = col[1] / 255;
			dustCol[i * 3 + 2] = col[2] / 255;
		}
		for (let i = 0; i < this.haloCount; i++) {
			const r = 180 + Math.pow(Math.random(), 2.8) * 480;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			haloPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			haloPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.25;
			haloPos[i * 3 + 2] = r * Math.cos(phi) * 0.25;
			const col = haloColorScale(Math.random()).rgb();
			haloCol[i * 3] = col[0] / 255;
			haloCol[i * 3 + 1] = col[1] / 255;
			haloCol[i * 3 + 2] = col[2] / 255;
		}
		this.bulgeGeometry.attributes.position.needsUpdate = true;
		this.bulgeGeometry.attributes.color.needsUpdate = true;
		this.dustGeometry.attributes.position.needsUpdate = true;
		this.dustGeometry.attributes.color.needsUpdate = true;
		this.haloGeometry.attributes.position.needsUpdate = true;
		this.haloGeometry.attributes.color.needsUpdate = true;
	}

	public update(
		data: Float32Array,
		pointSize: number,
		blackHoleIdx: number,
		deltaTime: number = 0.016,
	) {
		this.time += deltaTime;
		const mat = this.points.material as ShaderMaterial;
		mat.uniforms.pointSize.value = pointSize;
		mat.uniforms.time.value = this.time;
		(this.bulgePoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.8;
		(this.bulgePoints.material as ShaderMaterial).uniforms.time.value = this.time;
		(this.dustPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.5;
		(this.dustPoints.material as ShaderMaterial).uniforms.time.value = this.time;
		(this.haloPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 0.7;
		(this.haloPoints.material as ShaderMaterial).uniforms.time.value = this.time;
		this.lastPointSize = pointSize;

		let maxSpeed = 0.1;
		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const vx = data[base + 3];
			const vy = data[base + 4];
			const vz = data[base + 5];
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			this.speeds[i] = speed;
			if (speed > maxSpeed) maxSpeed = speed;
		}
		maxSpeed = Math.max(maxSpeed, 0.001);
		const invMaxSpeed = 1 / maxSpeed;

		const coreLUT = CORE_LUT;
		const armLUT = ARM_LUT;
		const speedLUT = SPEED_LUT;
		const dopplerLUT = DOPPLER_LUT;

		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const posIdx = i * 3;
			const x = data[base];
			const y = data[base + 1];
			const z = data[base + 2];
			this.positionArray[posIdx] = x;
			this.positionArray[posIdx + 1] = y;
			this.positionArray[posIdx + 2] = z;

			if (i === blackHoleIdx && data[base + 6] > 50000) {
				this.colorArray[posIdx] = 0;
				this.colorArray[posIdx + 1] = 0;
				this.colorArray[posIdx + 2] = 0;
				continue;
			}

			const dist = Math.sqrt(x * x + y * y + z * z) / 400;
			const angle = Math.atan2(y, x);
			const angle01 = (angle + Math.PI) / (Math.PI * 2);

			const speedFactor = Math.min(this.speeds[i] * invMaxSpeed, 1.0);

			const coreFactor = Math.min(1, Math.max(0, 1 - dist * 5));
			const armIndex = Math.min(
				Math.floor(dist * (armLUT.length / 3 - 1)),
				armLUT.length / 3 - 1,
			);
			const coreIndex = Math.min(
				Math.floor(coreFactor * (coreLUT.length / 3 - 1)),
				coreLUT.length / 3 - 1,
			);

			const armBaseR = armLUT[armIndex * 3];
			const armBaseG = armLUT[armIndex * 3 + 1];
			const armBaseB = armLUT[armIndex * 3 + 2];
			const coreR = coreLUT[coreIndex * 3];
			const coreG = coreLUT[coreIndex * 3 + 1];
			const coreB = coreLUT[coreIndex * 3 + 2];

			let R = armBaseR;
			let G = armBaseG;
			let B = armBaseB;
			const blend = coreFactor;
			R = R * (1 - blend) + coreR * blend;
			G = G * (1 - blend) + coreG * blend;
			B = B * (1 - blend) + coreB * blend;

			const pitch = 0.85;
			const logSpiral = Math.log(Math.max(dist, 0.01)) * pitch;
			const armPhase = (angle01 * 2 + logSpiral) % 1;
			const armIntensity = 0.5 + 0.5 * Math.sin(armPhase * Math.PI * 2);

			const dustPhase = (angle01 * 2 + logSpiral + 0.5) % 1;
			const dustIntensity = Math.sin(dustPhase * Math.PI * 2);
			const dustDarken = Math.max(0, Math.min(1, -dustIntensity * 0.5));

			const brightness =
				1.0 +
				armIntensity * 0.6 * Math.min(1, dist * 2.5) -
				dustDarken * 0.4 +
				speedFactor * 0.05;

			R *= brightness;
			G *= brightness;
			B *= brightness;

			const velocity = new Vector3(
				data[base + 3],
				data[base + 4],
				data[base + 5],
			).normalize();
			const cameraDirection = new Vector3(0, 0, 1);
			const doppler = velocity.dot(cameraDirection);
			const dopplerT = doppler * 0.5 + 0.5;
			const dopplerIdx = Math.min(
				Math.floor(dopplerT * (dopplerLUT.length / 3 - 1)),
				dopplerLUT.length / 3 - 1,
			);
			const dopplerR = dopplerLUT[dopplerIdx * 3];
			const dopplerG = dopplerLUT[dopplerIdx * 3 + 1];
			const dopplerB = dopplerLUT[dopplerIdx * 3 + 2];

			R = R * 0.95 + dopplerR * 0.05;
			G = G * 0.95 + dopplerG * 0.05;
			B = B * 0.95 + dopplerB * 0.05;

			const speedIdx = Math.min(
				Math.floor(speedFactor * (speedLUT.length / 3 - 1)),
				speedLUT.length / 3 - 1,
			);
			const sR = speedLUT[speedIdx * 3];
			const sG = speedLUT[speedIdx * 3 + 1];
			const sB = speedLUT[speedIdx * 3 + 2];
			R = R * 0.85 + sR * 0.15;
			G = G * 0.85 + sG * 0.15;
			B = B * 0.85 + sB * 0.15;

			this.colorArray[posIdx] = Math.min(R, 1.6);
			this.colorArray[posIdx + 1] = Math.min(G, 1.6);
			this.colorArray[posIdx + 2] = Math.min(B, 1.6);
		}

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.color.needsUpdate = true;

		for (let i = 0; i < this.bulgeCount; i++) {
			const srcIdx = this.bulgeMap[i] * 3;
			const dstIdx = i * 3;
			this.bulgePositionArray[dstIdx] = this.positionArray[srcIdx];
			this.bulgePositionArray[dstIdx + 1] = this.positionArray[srcIdx + 1];
			this.bulgePositionArray[dstIdx + 2] = this.positionArray[srcIdx + 2];
		}
		this.bulgeGeometry.attributes.position.needsUpdate = true;

		for (let i = 0; i < this.dustCount; i++) {
			const srcIdx = this.dustMap[i] * 3;
			const dstIdx = i * 3;
			this.dustPositionArray[dstIdx] = this.positionArray[srcIdx];
			this.dustPositionArray[dstIdx + 1] = this.positionArray[srcIdx + 1];
			this.dustPositionArray[dstIdx + 2] = this.positionArray[srcIdx + 2];
		}
		this.dustGeometry.attributes.position.needsUpdate = true;

		for (let i = 0; i < this.haloCount; i++) {
			const srcIdx = this.haloMap[i] * 3;
			const dstIdx = i * 3;
			this.haloPositionArray[dstIdx] = this.positionArray[srcIdx];
			this.haloPositionArray[dstIdx + 1] = this.positionArray[srcIdx + 1];
			this.haloPositionArray[dstIdx + 2] = this.positionArray[srcIdx + 2];
		}
		this.haloGeometry.attributes.position.needsUpdate = true;

		this.updateBlackHoleSprite(data, pointSize, blackHoleIdx);
	}

	private updateBlackHoleSprite(data: Float32Array, pointSize: number, blackHoleIdx: number) {
		if (!this.blackHoleSprite) return;
		if (blackHoleIdx < 0 || blackHoleIdx >= this.count) {
			this.blackHoleSprite.visible = false;
			return;
		}
		const base = blackHoleIdx * STRIDE;
		if (data[base + 6] > 50000) {
			this.blackHoleSprite.position.set(data[base], data[base + 1], data[base + 2]);
			this.blackHoleSprite.visible = true;
			const scale = pointSize * 12.0;
			this.blackHoleSprite.scale.set(scale, scale, 1);
		} else {
			this.blackHoleSprite.visible = false;
		}
	}

	public dispose() {
		this.geometry.dispose();
		this.bulgeGeometry.dispose();
		this.dustGeometry.dispose();
		this.haloGeometry.dispose();
		this.backgroundGeometry.dispose();
		(this.points.material as ShaderMaterial).dispose();
		(this.bulgePoints.material as ShaderMaterial).dispose();
		(this.dustPoints.material as ShaderMaterial).dispose();
		(this.haloPoints.material as ShaderMaterial).dispose();
		if (this.backgroundStars) (this.backgroundStars.material as ShaderMaterial).dispose();
		if (this.blackHoleSprite) this.blackHoleSprite.material.dispose();
	}
}
