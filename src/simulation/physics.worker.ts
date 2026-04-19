const STRIDE = 7;

self.onmessage = (e: MessageEvent) => {
	const { myData, allData, startIdx, endIdx, count, G, DT, SOFTENING, STEPS } = e.data;
	const subDt = DT / STEPS;
	const softeningSq = SOFTENING * SOFTENING;

	for (let step = 0; step < STEPS; step++) {
		for (let i = startIdx; i < endIdx; i++) {
			const i7 = i * STRIDE;
			const ivx = i7 + 3;
			const ivy = i7 + 4;
			const ivz = i7 + 5;

			const px = allData[i7];
			const py = allData[i7 + 1];
			const pz = allData[i7 + 2];

			let ax = 0;
			let ay = 0;
			let az = 0;

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

			allData[ivx] += ax * subDt * 0.5;
			allData[ivy] += ay * subDt * 0.5;
			allData[ivz] += az * subDt * 0.5;

			allData[i7] += allData[ivx] * subDt;
			allData[i7 + 1] += allData[ivy] * subDt;
			allData[i7 + 2] += allData[ivz] * subDt;
		}

		for (let i = startIdx; i < endIdx; i++) {
			const i7 = i * STRIDE;
			const ivx = i7 + 3;
			const ivy = i7 + 4;
			const ivz = i7 + 5;

			const px = allData[i7];
			const py = allData[i7 + 1];
			const pz = allData[i7 + 2];

			let ax = 0;
			let ay = 0;
			let az = 0;

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

			allData[ivx] += ax * subDt * 0.5;
			allData[ivy] += ay * subDt * 0.5;
			allData[ivz] += az * subDt * 0.5;
		}
	}

	const slice = myData;
	for (let i = startIdx; i < endIdx; i++) {
		const base = i * STRIDE;
		const sliceBase = (i - startIdx) * STRIDE;
		slice[sliceBase] = allData[base];
		slice[sliceBase + 1] = allData[base + 1];
		slice[sliceBase + 2] = allData[base + 2];
		slice[sliceBase + 3] = allData[base + 3];
		slice[sliceBase + 4] = allData[base + 4];
		slice[sliceBase + 5] = allData[base + 5];
		slice[sliceBase + 6] = allData[base + 6];
	}

	self.postMessage({ slice, startIdx }, { transfer: [slice.buffer] });
};
