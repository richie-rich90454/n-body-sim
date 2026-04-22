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
		this.bulgeCount = Math.floor(count * 0.12);
		this.dustCount = Math.floor(count * 0.18);
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
			uniforms: { pointSize: { value: 3.2 } },
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
			uniforms: { pointSize: { value: 3.0 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (330.0 / -mvPosition.z);
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
			uniforms: { pointSize: { value: 1.1 } },
			vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (260.0 / -mvPosition.z);
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

	private createBlackHoleSprite() {
		const size = 512;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const centerX = size / 2;
		const centerY = size / 2;

		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, size, size);

		const ringImageData = ctx.createImageData(size, size);
		const data = ringImageData.data;

		const innerRadius = 50;
		const outerRadius = 120;
		const voidRadius = 40;

		for (let py = 0; py < size; py++) {
			for (let px = 0; px < size; px++) {
				const dx = px - centerX;
				const dy = py - centerY;
				const r = Math.sqrt(dx * dx + dy * dy);

				if (r < voidRadius || r > outerRadius + 15) continue;

				let intensity = 0;
				if (r >= innerRadius && r <= outerRadius) {
					const t = (r - innerRadius) / (outerRadius - innerRadius);
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

				const warmness = Math.max(0, Math.min(1, (dy / r) * 0.7 + 0.5));

				let R = Math.floor(255 * (1.0 * warmness + 0.8 * (1 - warmness)) * intensity);
				let G = Math.floor(200 * warmness * intensity + 60 * (1 - warmness) * intensity);
				let B = Math.floor(80 * warmness * intensity + 20 * (1 - warmness) * intensity);

				if (intensity > 0.05) {
					const idx = (py * size + px) * 4;
					data[idx] = Math.min(255, R);
					data[idx + 1] = Math.min(255, G);
					data[idx + 2] = Math.min(255, B);
					data[idx + 3] = Math.floor(intensity * 200);
				}
			}
		}

		ctx.putImageData(ringImageData, 0, 0);

		const outerGlow = ctx.createRadialGradient(
			centerX,
			centerY,
			innerRadius,
			centerX,
			centerY,
			outerRadius + 35,
		);
		outerGlow.addColorStop(0, "rgba(255, 140, 40, 0.25)");
		outerGlow.addColorStop(1, "rgba(80, 30, 10, 0)");
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
		const bulgePos = this.bulgeGeometry.attributes.position.array as Float32Array;
		const bulgeCol = this.bulgeGeometry.attributes.color.array as Float32Array;
		const dustPos = this.dustGeometry.attributes.position.array as Float32Array;
		const dustCol = this.dustGeometry.attributes.color.array as Float32Array;
		const haloPos = this.haloGeometry.attributes.position.array as Float32Array;
		const haloCol = this.haloGeometry.attributes.color.array as Float32Array;

		for (let i = 0; i < this.bulgeCount; i++) {
			const r = Math.pow(Math.random(), 1.6) * 65;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = r * Math.sin(phi) * Math.cos(theta);
			const y = r * Math.sin(phi) * Math.sin(theta) * 0.7;
			const z = r * Math.cos(phi) * 0.7;
			bulgePos[i * 3] = x;
			bulgePos[i * 3 + 1] = y;
			bulgePos[i * 3 + 2] = z;
			const mix = r / 65;
			bulgeCol[i * 3] = 1.0;
			bulgeCol[i * 3 + 1] = 0.75 + mix * 0.25;
			bulgeCol[i * 3 + 2] = 0.45 + mix * 0.35;
		}

		for (let i = 0; i < this.dustCount; i++) {
			const r = 40 + Math.pow(Math.random(), 2.0) * 240;
			const theta = Math.random() * Math.PI * 2;
			const x = r * Math.cos(theta);
			const y = (Math.random() - 0.5) * 28;
			const z = r * Math.sin(theta) * 0.35;
			dustPos[i * 3] = x;
			dustPos[i * 3 + 1] = y;
			dustPos[i * 3 + 2] = z;
			const bright = 0.35 + 0.3 * Math.random();
			dustCol[i * 3] = bright * 0.9;
			dustCol[i * 3 + 1] = bright * 0.7;
			dustCol[i * 3 + 2] = bright * 0.5;
		}

		for (let i = 0; i < this.haloCount; i++) {
			const r = 180 + Math.pow(Math.random(), 2.8) * 480;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = r * Math.sin(phi) * Math.cos(theta);
			const y = r * Math.sin(phi) * Math.sin(theta) * 0.25;
			const z = r * Math.cos(phi) * 0.25;
			haloPos[i * 3] = x;
			haloPos[i * 3 + 1] = y;
			haloPos[i * 3 + 2] = z;
			haloCol[i * 3] = 0.5 + 0.4 * Math.random();
			haloCol[i * 3 + 1] = 0.6 + 0.4 * Math.random();
			haloCol[i * 3 + 2] = 1.0 + 0.2 * Math.random();
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
		(this.bulgePoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.8;
		(this.dustPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 1.5;
		(this.haloPoints.material as ShaderMaterial).uniforms.pointSize.value = pointSize * 0.7;
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

			let r = 0.45 + 0.4 * dist + t * 0.2;
			let g = 0.55 + 0.45 * dist + t * 0.2;
			let b = 0.9 + 0.25 * (1 - dist) + t * 0.15;

			r = Math.min(r, 1.0);
			g = Math.min(g, 1.0);
			b = Math.min(b, 1.0);

			if (dist < 0.18) {
				r = 0.95;
				g = 0.75;
				b = 0.45;
			}

			this.colorArray[posIdx] = r;
			this.colorArray[posIdx + 1] = g;
			this.colorArray[posIdx + 2] = b;
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
		if (this.blackHoleSprite) {
			this.blackHoleSprite.material.dispose();
		}
	}
}
