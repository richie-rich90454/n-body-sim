import {
	Points,
	BufferGeometry,
	BufferAttribute,
	PointsMaterial,
	AdditiveBlending,
	Sprite,
	SpriteMaterial,
	CanvasTexture,
} from "three";
import { STRIDE } from "../math/PhysicsEngine";

export class ParticleSystem {
	public points: Points;
	private geometry: BufferGeometry;
	private count: number;
	private positionArray: Float32Array;
	private colorArray: Float32Array;
	public blackHoleSprite: Sprite | null = null;
	private speeds: Float32Array;
	private lastPointSize = 1.8;

	constructor(count: number) {
		this.count = count;
		this.geometry = new BufferGeometry();
		this.positionArray = new Float32Array(count * 3);
		this.colorArray = new Float32Array(count * 3);
		this.speeds = new Float32Array(count);

		this.geometry.setAttribute("position", new BufferAttribute(this.positionArray, 3));
		this.geometry.setAttribute("color", new BufferAttribute(this.colorArray, 3));

		const material = new PointsMaterial({
			size: 1.2,
			vertexColors: true,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
			sizeAttenuation: true,
		});

		this.points = new Points(this.geometry, material);
		this.createBlackHoleSprite();
	}

	private createBlackHoleSprite() {
		const canvas = document.createElement("canvas");
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
		gradient.addColorStop(0, "rgba(255, 220, 150, 1)");
		gradient.addColorStop(0.2, "rgba(255, 150, 50, 1)");
		gradient.addColorStop(0.4, "rgba(255, 80, 20, 0.9)");
		gradient.addColorStop(0.6, "rgba(200, 40, 10, 0.7)");
		gradient.addColorStop(0.8, "rgba(100, 15, 5, 0.4)");
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
		this.blackHoleSprite.scale.set(120, 120, 1);
		this.blackHoleSprite.visible = false;
	}

	public update(data: Float32Array, pointSize: number, blackHoleIdx: number) {
		const mat = this.points.material as PointsMaterial;
		if (this.lastPointSize !== pointSize) {
			mat.size = pointSize;
			this.lastPointSize = pointSize;
		}

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
			this.positionArray[posIdx] = data[base];
			this.positionArray[posIdx + 1] = data[base + 1];
			this.positionArray[posIdx + 2] = data[base + 2];

			const t = Math.min(this.speeds[i] / maxSpeed, 1.0);
			const r = t;
			const g = 0.6 + 0.4 * Math.sin(t * Math.PI);
			const b = 1.0 - t * 0.7;

			this.colorArray[posIdx] = r;
			this.colorArray[posIdx + 1] = g * 0.8;
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
			const scale = pointSize * 10.0;
			this.blackHoleSprite.scale.set(scale, scale, 1);
		} else {
			this.blackHoleSprite.visible = false;
		}
	}

	public dispose() {
		this.geometry.dispose();
		const material = this.points.material;
		if (Array.isArray(material)) {
			material.forEach((m) => m.dispose());
		} else {
			material.dispose();
		}
		if (this.blackHoleSprite) {
			this.blackHoleSprite.material.dispose();
		}
	}
}
