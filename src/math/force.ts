import { STRIDE } from "./PhysicsEngine";

export function computeAccelerations(
    data: Float32Array,
    count: number,
    G: number,
    softeningSq: number,
    startIdx: number = 0,
    endIdx: number = count,
): Float32Array {
    const accel = new Float32Array(count * 3);
    if (endIdx > startIdx && count > 0) {
        for (let i = startIdx; i < endIdx; i++) {
            const i7 = i * STRIDE;
            const px = data[i7];
            const py = data[i7 + 1];
            const pz = data[i7 + 2];
            const mi = data[i7 + 6];
            const i3 = i * 3;
            for (let j = i + 1; j < count; j++) {
                const j7 = j * STRIDE;
                const dx = data[j7] - px;
                const dy = data[j7 + 1] - py;
                const dz = data[j7 + 2] - pz;
                const mj = data[j7 + 6];
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
    return accel;
}
