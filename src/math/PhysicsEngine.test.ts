import { describe, expect, it } from "vitest";
import { STRIDE } from "./PhysicsEngine";
import { computeAccelerations } from "./force";
function buildTwoBody(
    m1: number,
    m2: number,
    p1x: number,
    p1y: number,
    p1z: number,
    p2x: number,
    p2y: number,
    p2z: number,
): Float32Array {
    const data = new Float32Array(2 * STRIDE);
    data[0] = p1x;
    data[1] = p1y;
    data[2] = p1z;
    data[6] = m1;
    data[7] = p2x;
    data[8] = p2y;
    data[9] = p2z;
    data[13] = m2;
    return data;
}
describe("computeAccelerations (2-body Newtonian)", function () {
    it("matches analytic acceleration along the x-axis", function () {
        const G = 1;
        const softeningSq = 0;
        const m1 = 1;
        const m2 = 2;
        const d = 3;
        const data = buildTwoBody(m1, m2, 0, 0, 0, d, 0, 0);
        const accel = computeAccelerations(data, 2, G, softeningSq);
        const expected0 = (G * m2) / (d * d);
        const expected1 = (G * m1) / (d * d);
        expect(accel[0]).toBeCloseTo(expected0, 6);
        expect(accel[1]).toBeCloseTo(0, 6);
        expect(accel[2]).toBeCloseTo(0, 6);
        expect(accel[3]).toBeCloseTo(-expected1, 6);
        expect(accel[4]).toBeCloseTo(0, 6);
        expect(accel[5]).toBeCloseTo(0, 6);
    });
    it("matches analytic acceleration for varied masses and distance", function () {
        const G = 1.5;
        const softeningSq = 0;
        const m1 = 5;
        const m2 = 3;
        const d = 4;
        const data = buildTwoBody(m1, m2, 0, 0, 0, d, 0, 0);
        const accel = computeAccelerations(data, 2, G, softeningSq);
        const expected0 = (G * m2) / (d * d);
        const expected1 = (G * m1) / (d * d);
        expect(accel[0]).toBeCloseTo(expected0, 6);
        expect(accel[3]).toBeCloseTo(-expected1, 6);
    });
    it("matches analytic acceleration for a 3D offset separation", function () {
        const G = 2;
        const softeningSq = 0;
        const m1 = 2;
        const m2 = 7;
        const dx = 1;
        const dy = 2;
        const dz = 3;
        const data = buildTwoBody(m1, m2, 0, 0, 0, dx, dy, dz);
        const accel = computeAccelerations(data, 2, G, softeningSq);
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        const factor0 = (G * m2) / (distSq * dist);
        const factor1 = (G * m1) / (distSq * dist);
        expect(accel[0]).toBeCloseTo(dx * factor0, 6);
        expect(accel[1]).toBeCloseTo(dy * factor0, 6);
        expect(accel[2]).toBeCloseTo(dz * factor0, 6);
        expect(accel[3]).toBeCloseTo(-dx * factor1, 6);
        expect(accel[4]).toBeCloseTo(-dy * factor1, 6);
        expect(accel[5]).toBeCloseTo(-dz * factor1, 6);
    });
    it("respects Newton's third law (equal and opposite forces)", function () {
        const G = 1;
        const softeningSq = 0;
        const m1 = 4;
        const m2 = 6;
        const data = buildTwoBody(m1, m2, 0, 0, 0, 2, 0, 0);
        const accel = computeAccelerations(data, 2, G, softeningSq);
        expect(accel[0] * m1).toBeCloseTo(-accel[3] * m2, 6);
        expect(accel[1] * m1).toBeCloseTo(-accel[4] * m2, 6);
        expect(accel[2] * m1).toBeCloseTo(-accel[5] * m2, 6);
    });
});
