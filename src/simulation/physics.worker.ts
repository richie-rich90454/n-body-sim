// src/simulation/physics.worker.ts
const STRIDE = 7;
self.onmessage = (e: MessageEvent) => {
	const { allData, startIdx, endIdx, count, G, softeningSq } = e.data;
	const length = endIdx - startIdx;
	const accel = new Float32Array(length * 3);
	if (length <= 0) {
		self.postMessage({ accel, startIdx }, { transfer: [accel.buffer] });
		return;
	}
	let accelIdx = 0;
	for (let i = startIdx; i < endIdx; i++) {
		const i7 = i * STRIDE;
		const px = allData[i7];
		const py = allData[i7 + 1];
		const pz = allData[i7 + 2];
		let ax = 0,
			ay = 0,
			az = 0;
		for (let j = 0; j < count; j++) {
			if (i === j) continue;
			const j7 = j * STRIDE;
			const dx = allData[j7] - px;
			const dy = allData[j7 + 1] - py;
			const dz = allData[j7 + 2] - pz;
			const mj = allData[j7 + 6];
			const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
			const invDist = 1 / Math.sqrt(distSq);
			const factor = G * mj * invDist * invDist * invDist;
			ax += dx * factor;
			ay += dy * factor;
			az += dz * factor;
		}
		accel[accelIdx++] = ax;
		accel[accelIdx++] = ay;
		accel[accelIdx++] = az;
	}
	self.postMessage({ accel, startIdx }, { transfer: [accel.buffer] });
};
