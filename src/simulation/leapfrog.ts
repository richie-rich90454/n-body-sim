import { STRIDE } from "../math/PhysicsEngine";

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
