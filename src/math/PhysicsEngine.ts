export const STRIDE = 7;

export function initializeGalaxy(particleCount: number, radius: number): Float32Array {
	const data = new Float32Array(particleCount * STRIDE);
	const G = 0.5;

	for (let i = 0; i < particleCount; i++) {
		const idx = i * STRIDE;
		const r = Math.pow(Math.random(), 1.5) * radius;
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(2 * Math.random() - 1);

		const x = r * Math.sin(phi) * Math.cos(theta);
		const y = r * Math.sin(phi) * Math.sin(theta) * 0.4;
		const z = r * Math.cos(phi);

		data[idx] = x;
		data[idx + 1] = y;
		data[idx + 2] = z;

		const mass = 0.5 + Math.random() * 2.0;
		data[idx + 6] = mass;

		if (i === 0) {
			data[idx + 3] = 0;
			data[idx + 4] = 0;
			data[idx + 5] = 0;
		} else {
			const enclosedMass =
				((2.0 * (4.0 / 3.0) * Math.PI * Math.pow(r, 3)) / Math.pow(radius, 3)) *
				particleCount *
				0.001;
			const speed = Math.sqrt((G * enclosedMass) / (r + 1.0)) * (0.6 + 0.3 * Math.random());
			const vx = -speed * Math.sin(theta);
			const vy = speed * Math.cos(theta) * 0.6;
			const vz = (Math.random() - 0.5) * speed * 0.3;

			data[idx + 3] = vx;
			data[idx + 4] = vy;
			data[idx + 5] = vz;
		}
	}

	return data;
}
