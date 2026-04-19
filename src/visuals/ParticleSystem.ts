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

	constructor(count: number) {
		this.count = count;
		this.geometry = new BufferGeometry();

		this.positionArray = new Float32Array(count * 3);
		this.colorArray = new Float32Array(count * 3);

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
		canvas.width = 128;
		canvas.height = 128;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		gradient.addColorStop(0, "rgba(255, 180, 100, 1)");
		gradient.addColorStop(0.4, "rgba(255, 100, 50, 0.9)");
		gradient.addColorStop(0.6, "rgba(200, 50, 20, 0.7)");
		gradient.addColorStop(0.8, "rgba(100, 20, 10, 0.4)");
		gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 128, 128);

		const texture = new CanvasTexture(canvas);
		const material = new SpriteMaterial({
			map: texture,
			blending: AdditiveBlending,
			depthWrite: false,
		});

		this.blackHoleSprite = new Sprite(material);
		this.blackHoleSprite.scale.set(80, 80, 1);
		this.blackHoleSprite.visible = false;
	}

	public update(data: Float32Array, pointSize: number) {
		const mat = this.points.material as PointsMaterial;
		mat.size = pointSize;

		const speeds = new Float32Array(this.count);
		let maxSpeed = 0.1;

		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const vx = data[base + 3];
			const vy = data[base + 4];
			const vz = data[base + 5];
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			speeds[i] = speed;
			if (speed > maxSpeed) maxSpeed = speed;
		}
		maxSpeed = Math.max(maxSpeed, 0.001);

		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const posIdx = i * 3;
			this.positionArray[posIdx] = data[base];
			this.positionArray[posIdx + 1] = data[base + 1];
			this.positionArray[posIdx + 2] = data[base + 2];

			const t = Math.min(speeds[i] / maxSpeed, 1.0);
			const r = t;
			const g = 0.6 + 0.4 * Math.sin(t * Math.PI);
			const b = 1.0 - t * 0.7;

			this.colorArray[posIdx] = r;
			this.colorArray[posIdx + 1] = g * 0.8;
			this.colorArray[posIdx + 2] = b;
		}

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.color.needsUpdate = true;

		this.updateBlackHoleSprite(data, pointSize);
	}

	private updateBlackHoleSprite(data: Float32Array, pointSize: number) {
		if (!this.blackHoleSprite) return;

		const blackHoleMass = data[6];

		if (blackHoleMass > 50000) {
			this.blackHoleSprite.position.set(data[0], data[1], data[2]);
			this.blackHoleSprite.visible = true;
			this.blackHoleSprite.scale.set(pointSize * 4, pointSize * 4, 1);
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
