import {
	Points,
	BufferGeometry,
	BufferAttribute,
	ShaderMaterial,
	AdditiveBlending,
	Sprite,
	SpriteMaterial,
	CanvasTexture,
} from "three";
import { STRIDE } from "../math/PhysicsEngine";

export class ParticleSystem {
	public points: Points;
	public bulgePoints: Points;
	public dustPoints: Points;
	public haloPoints: Points;
	private geometry: BufferGeometry;
	private bulgeGeometry: BufferGeometry;
	private dustGeometry: BufferGeometry;
	private haloGeometry: BufferGeometry;
	private count: number;
	private bulgeCount: number;
	private dustCount: number;
	private haloCount: number;
	private positionArray: Float32Array;
	private colorArray: Float32Array;
	private bulgePositionArray: Float32Array;
	private bulgeColorArray: Float32Array;
	private dustPositionArray: Float32Array;
	private dustColorArray: Float32Array;
	private haloPositionArray: Float32Array;
	private haloColorArray: Float32Array;
	public blackHoleSprite: Sprite | null = null;
	private speeds: Float32Array;
	private lastPointSize = 1.8;

	constructor(count: number) {
		this.count = count;
		this.bulgeCount = Math.floor(count * 0.15);
		this.dustCount = Math.floor(count * 0.2);
		this.haloCount = count * 2;

		this.geometry = new BufferGeometry();
		this.bulgeGeometry = new BufferGeometry();
		this.dustGeometry = new BufferGeometry();
		this.haloGeometry = new BufferGeometry();

		this.positionArray = new Float32Array(count * 3);
		this.colorArray = new Float32Array(count * 3);
		this.bulgePositionArray = new Float32Array(this.bulgeCount * 3);
		this.bulgeColorArray = new Float32Array(this.bulgeCount * 3);
		this.dustPositionArray = new Float32Array(this.dustCount * 3);
		this.dustColorArray = new Float32Array(this.dustCount * 3);
		this.haloPositionArray = new Float32Array(this.haloCount * 3);
		this.haloColorArray = new Float32Array(this.haloCount * 3);
		this.speeds = new Float32Array(count);

		this.geometry.setAttribute("position", new BufferAttribute(this.positionArray, 3));
		this.geometry.setAttribute("color", new BufferAttribute(this.colorArray, 3));
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
	}

	private createMainMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: { pointSize: { value: 1.8 } },
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
          float alpha = pow(1.0 - r * 2.0, 1.2);
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
			uniforms: { pointSize: { value: 3.5 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (350.0 / -mvPosition.z);
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
          float glow = exp(-r * 3.0) * 1.5;
          gl_FragColor = vec4(vColor * glow, glow * 0.9);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
	}

	private createDustMaterial(): ShaderMaterial {
		return new ShaderMaterial({
			uniforms: { pointSize: { value: 2.2 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (320.0 / -mvPosition.z);
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
          float alpha = (1.0 - r * 2.0) * 0.6;
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
			uniforms: { pointSize: { value: 1.0 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (250.0 / -mvPosition.z);
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
          float alpha = (1.0 - r * 2.0) * 0.2;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
		});
	}

	private createBlackHoleSprite() {
		const canvas = document.createElement("canvas");
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
		gradient.addColorStop(0, "rgba(255, 220, 150, 1)");
		gradient.addColorStop(0.2, "rgba(255, 120, 30, 0.9)");
		gradient.addColorStop(0.5, "rgba(200, 50, 10, 0.6)");
		gradient.addColorStop(0.8, "rgba(80, 10, 2, 0.2)");
		gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 256, 256);
		const texture = new CanvasTexture(canvas);
		const material = new SpriteMaterial({
			map: texture,
			blending: AdditiveBlending,
			depthWrite: false,
		});
		this.blackHoleSprite = new Sprite(material);
		this.blackHoleSprite.scale.set(150, 150, 1);
		this.blackHoleSprite.visible = false;
	}

	private initializeStaticLayers() {
		const bulgePos = this.bulgeGeometry.attributes.position.array as Float32Array;
		const bulgeCol = this.bulgeGeometry.attributes.color.array as Float32Array;
		const dustPos = this.dustGeometry.attributes.position.array as Float32Array;
		const dustCol = this.dustGeometry.attributes.color.array as Float32Array;
		const haloPos = this.haloGeometry.attributes.position.array as Float32Array;
		const haloCol = this.haloGeometry.attributes.color.array as Float32Array;

		// Bulge: spherical, warm colors
		for (let i = 0; i < this.bulgeCount; i++) {
			const r = Math.pow(Math.random(), 1.5) * 80;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = r * Math.sin(phi) * Math.cos(theta);
			const y = r * Math.sin(phi) * Math.sin(theta) * 0.6;
			const z = r * Math.cos(phi) * 0.6;
			bulgePos[i * 3] = x;
			bulgePos[i * 3 + 1] = y;
			bulgePos[i * 3 + 2] = z;
			const mix = r / 80;
			const goldR = 1.0,
				goldG = 0.8 + mix * 0.2,
				goldB = 0.5 + mix * 0.3;
			bulgeCol[i * 3] = goldR;
			bulgeCol[i * 3 + 1] = goldG;
			bulgeCol[i * 3 + 2] = goldB;
		}

		// Dust lanes: dark brown, concentrated in disk plane
		for (let i = 0; i < this.dustCount; i++) {
			const r = 60 + Math.pow(Math.random(), 2.0) * 250;
			const theta = Math.random() * Math.PI * 2;
			const x = r * Math.cos(theta);
			const y = (Math.random() - 0.5) * 25;
			const z = r * Math.sin(theta) * 0.3;
			dustPos[i * 3] = x;
			dustPos[i * 3 + 1] = y;
			dustPos[i * 3 + 2] = z;
			const dark = 0.2 + 0.2 * Math.random();
			dustCol[i * 3] = dark * 0.8;
			dustCol[i * 3 + 1] = dark * 0.6;
			dustCol[i * 3 + 2] = dark * 0.4;
		}

		// Halo: old stars, blue/purple, large spherical distribution
		for (let i = 0; i < this.haloCount; i++) {
			const r = 200 + Math.pow(Math.random(), 2.5) * 450;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = r * Math.sin(phi) * Math.cos(theta);
			const y = r * Math.sin(phi) * Math.sin(theta) * 0.3;
			const z = r * Math.cos(phi) * 0.3;
			haloPos[i * 3] = x;
			haloPos[i * 3 + 1] = y;
			haloPos[i * 3 + 2] = z;
			const blueR = 0.5 + 0.4 * Math.random();
			const blueG = 0.5 + 0.5 * Math.random();
			const blueB = 0.9 + 0.3 * Math.random();
			haloCol[i * 3] = blueR * 0.7;
			haloCol[i * 3 + 1] = blueG * 0.7;
			haloCol[i * 3 + 2] = blueB;
		}

		this.bulgeGeometry.attributes.position.needsUpdate = true;
		this.bulgeGeometry.attributes.color.needsUpdate = true;
		this.dustGeometry.attributes.position.needsUpdate = true;
		this.dustGeometry.attributes.color.needsUpdate = true;
		this.haloGeometry.attributes.position.needsUpdate = true;
		this.haloGeometry.attributes.color.needsUpdate = true;
	}

	public update(data: Float32Array, pointSize: number, blackHoleIdx: number) {
		const mat = this.points.material as ShaderMaterial;
		mat.uniforms.pointSize.value = pointSize;
		(this.bulgePoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 2.0;
		(this.dustPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.3;
		(this.haloPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 0.6;
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

		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const posIdx = i * 3;
			const x = data[base];
			const y = data[base + 1];
			const z = data[base + 2];
			this.positionArray[posIdx] = x;
			this.positionArray[posIdx + 1] = y;
			this.positionArray[posIdx + 2] = z;

			const t = Math.min(this.speeds[i] / maxSpeed, 1.0);
			const dist = Math.sqrt(x * x + y * y + z * z) / 400;
			const height = Math.abs(y) / 60;

			// Color mapping inspired by Milky Way: inner gold, outer blue, dust influence
			const r = 0.8 + 0.5 * Math.sin(dist * 8.0) * (1 - dist) + t * 0.2;
			const g = 0.5 + 0.5 * (1 - dist) + t * 0.3;
			const b = 0.3 + 0.7 * dist + t * 0.5;

			this.colorArray[posIdx] = Math.min(r, 1.0);
			this.colorArray[posIdx + 1] = Math.min(g, 1.0);
			this.colorArray[posIdx + 2] = Math.min(b, 1.0);
		}

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.color.needsUpdate = true;

		this.updateBlackHoleSprite(data, pointSize, blackHoleIdx);
	}

	private updateBlackHoleSprite(data: Float32Array, pointSize: number, blackHoleIdx: number) {
		if (!this.blackHoleSprite) return;
		if (blackHoleIdx < 0 || blackHoleIdx >= this.count) {
			this.blackHoleSprite.visible = false;
			return;
		}
		const base = blackHoleIdx * STRIDE;
		const mass = data[base + 6];
		if (mass > 50000) {
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
		(this.points.material as ShaderMaterial).dispose();
		(this.bulgePoints.material as ShaderMaterial).dispose();
		(this.dustPoints.material as ShaderMaterial).dispose();
		(this.haloPoints.material as ShaderMaterial).dispose();
		if (this.blackHoleSprite) this.blackHoleSprite.material.dispose();
	}
}
