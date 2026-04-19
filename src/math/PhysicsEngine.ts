export const STRIDE = 7;

export function initializeGalaxy(particleCount: number, radius: number): Float32Array {
	const data = new Float32Array(particleCount * STRIDE);
	const centerMass = 20000;
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

		if (i === 0) {
			data[idx + 3] = 0;
			data[idx + 4] = 0;
			data[idx + 5] = 0;
			data[idx + 6] = 0.5 + Math.random() * 2.0;
		} else {
			const speed = Math.sqrt((G * centerMass) / (r + 10)) * (0.8 + 0.4 * Math.random());
			const vx = -speed * Math.sin(theta);
			const vy = speed * Math.cos(theta) * 0.6;
			const vz = (Math.random() - 0.5) * speed * 0.3;

			data[idx + 3] = vx;
			data[idx + 4] = vy;
			data[idx + 5] = vz;
			data[idx + 6] = 0.5 + Math.random() * 2.0;
		}
	}

	return data;
}
