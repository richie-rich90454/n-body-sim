import { Points, BufferGeometry, BufferAttribute, PointsMaterial, AdditiveBlending } from "three";
import { STRIDE } from "../math/PhysicsEngine";

export class ParticleSystem {
	public points: Points;
	private geometry: BufferGeometry;
	private count: number;
	private positionArray: Float32Array;
	private colorArray: Float32Array;

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
	}

	public update(data: Float32Array, pointSize: number) {
		const mat = this.points.material as PointsMaterial;
		mat.size = pointSize;

		let maxSpeed = 0.1;
		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const vx = data[base + 3];
			const vy = data[base + 4];
			const vz = data[base + 5];
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			if (speed > maxSpeed) maxSpeed = speed;
		}
		maxSpeed = Math.max(maxSpeed, 0.001);

		for (let i = 0; i < this.count; i++) {
			const base = i * STRIDE;
			const posIdx = i * 3;
			this.positionArray[posIdx] = data[base];
			this.positionArray[posIdx + 1] = data[base + 1];
			this.positionArray[posIdx + 2] = data[base + 2];

			const vx = data[base + 3];
			const vy = data[base + 4];
			const vz = data[base + 5];
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			const t = Math.min(speed / maxSpeed, 1.0);

			const r = t;
			const g = 0.6 + 0.4 * Math.sin(t * Math.PI);
			const b = 1.0 - t * 0.7;

			this.colorArray[posIdx] = r;
			this.colorArray[posIdx + 1] = g * 0.8;
			this.colorArray[posIdx + 2] = b;
		}

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.attributes.color.needsUpdate = true;
	}

	public dispose() {
		this.geometry.dispose();
		const material = this.points.material;
		if (Array.isArray(material)) {
			material.forEach((m) => m.dispose());
		} else {
			material.dispose();
		}
	}
}
