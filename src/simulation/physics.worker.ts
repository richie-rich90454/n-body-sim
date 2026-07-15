const STRIDE = 7;
let allData: Float32Array;

self.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === "init") {
        allData = new Float32Array(msg.buffer);
        return;
    }
    if (msg.type === "accel") {
        const { startIdx, endIdx, count, G, softeningSq } = msg;
        const accel = new Float32Array(count * 3);
        if (endIdx > startIdx && count > 0) {
            for (let i = startIdx; i < endIdx; i++) {
                const i7 = i * STRIDE;
                const px = allData[i7];
                const py = allData[i7 + 1];
                const pz = allData[i7 + 2];
                const mi = allData[i7 + 6];
                const i3 = i * 3;
                for (let j = i + 1; j < count; j++) {
                    const j7 = j * STRIDE;
                    const dx = allData[j7] - px;
                    const dy = allData[j7 + 1] - py;
                    const dz = allData[j7 + 2] - pz;
                    const mj = allData[j7 + 6];
                    const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
                    const invDist = 1 / Math.sqrt(distSq);
                    const factor = G * mj * invDist * invDist * invDist;
                    const axc = dx * factor;
                    const ayc = dy * factor;
                    const azc = dz * factor;
                    accel[i3] += axc;
                    accel[i3 + 1] += ayc;
                    accel[i3 + 2] += azc;
                    const j3 = j * 3;
                    const ratio = mi / mj;
                    accel[j3] -= axc * ratio;
                    accel[j3 + 1] -= ayc * ratio;
                    accel[j3 + 2] -= azc * ratio;
                }
            }
        }
        self.postMessage({ accel, startIdx }, { transfer: [accel.buffer] });
    }
};

export {};
