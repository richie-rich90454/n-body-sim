import { STRIDE } from "../math/PhysicsEngine";

export const YOSHIDA4_D1 = 1.3512071887741473;
export const YOSHIDA4_D2 = -1.7012416134405736;
export const YOSHIDA4_K1 = YOSHIDA4_D1 / 2;
export const YOSHIDA4_K2 = (YOSHIDA4_D1 + YOSHIDA4_D2) / 2;

export function applyFirstHalfKickAndDrift(
    data: Float32Array,
    accel: Float32Array,
    count: number,
    subDt: number,
    startIdx: number = 0,
): void {
    for (let i = startIdx; i < count; i++) {
        const i7 = i * STRIDE;
        const ax = accel[i * 3];
        const ay = accel[i * 3 + 1];
        const az = accel[i * 3 + 2];
        data[i7 + 3] += ax * subDt * 0.5;
        data[i7 + 4] += ay * subDt * 0.5;
        data[i7 + 5] += az * subDt * 0.5;
        data[i7] += data[i7 + 3] * subDt;
        data[i7 + 1] += data[i7 + 4] * subDt;
        data[i7 + 2] += data[i7 + 5] * subDt;
    }
}

export function applySecondHalfKick(
    data: Float32Array,
    accel: Float32Array,
    count: number,
    subDt: number,
    startIdx: number = 0,
): void {
    for (let i = startIdx; i < count; i++) {
        const i7 = i * STRIDE;
        const ax = accel[i * 3];
        const ay = accel[i * 3 + 1];
        const az = accel[i * 3 + 2];
        data[i7 + 3] += ax * subDt * 0.5;
        data[i7 + 4] += ay * subDt * 0.5;
        data[i7 + 5] += az * subDt * 0.5;
    }
}

export function applyYoshida4KickDrift(
    data: Float32Array,
    accel: Float32Array,
    count: number,
    subDt: number,
    phase: number,
    startIdx: number = 0,
): void {
    const kickW = phase === 0 || phase === 3 ? YOSHIDA4_K1 : YOSHIDA4_K2;
    const driftW = phase === 1 ? YOSHIDA4_D2 : YOSHIDA4_D1;
    for (let i = startIdx; i < count; i++) {
        const i7 = i * STRIDE;
        const ax = accel[i * 3];
        const ay = accel[i * 3 + 1];
        const az = accel[i * 3 + 2];
        data[i7 + 3] += ax * kickW * subDt;
        data[i7 + 4] += ay * kickW * subDt;
        data[i7 + 5] += az * kickW * subDt;
        if (phase < 3) {
            data[i7] += data[i7 + 3] * driftW * subDt;
            data[i7 + 1] += data[i7 + 4] * driftW * subDt;
            data[i7 + 2] += data[i7 + 5] * driftW * subDt;
        }
    }
}
