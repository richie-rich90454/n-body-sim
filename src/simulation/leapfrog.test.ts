import { describe, expect, it } from "vitest";
import { STRIDE } from "../math/PhysicsEngine";
import { computeAccelerations } from "../math/force";
import { computeTotalEnergy } from "./energy";
import {
    applyFirstHalfKickAndDrift,
    applySecondHalfKick,
    applyYoshida4KickDrift,
} from "./leapfrog";
function makeCircularOrbit(G: number, M: number, m: number, r: number): Float32Array {
    const v = Math.sqrt((G * M) / r);
    const data = new Float32Array(2 * STRIDE);
    data[6] = M;
    data[7] = r;
    data[11] = v;
    data[13] = m;
    return data;
}
describe("leapfrog energy preservation over 1000 steps", function () {
    it("drifts less than 1 percent for a circular 2-body orbit", function () {
        const G = 1;
        const softeningSq = 0;
        const dt = 0.001;
        const steps = 1000;
        const data = makeCircularOrbit(G, 1000, 1, 1);
        const e0 = computeTotalEnergy(data, 2, G, softeningSq);
        for (let s = 0; s < steps; s++) {
            const a0 = computeAccelerations(data, 2, G, softeningSq);
            applyFirstHalfKickAndDrift(data, a0, 2, dt);
            const a1 = computeAccelerations(data, 2, G, softeningSq);
            applySecondHalfKick(data, a1, 2, dt);
        }
        const eFinal = computeTotalEnergy(data, 2, G, softeningSq);
        const drift = Math.abs((eFinal - e0) / e0);
        expect(drift).toBeLessThan(0.01);
    });
});
describe("Yoshida-4 energy preservation over 1000 steps", function () {
    it("drifts less than 0.1 percent for a circular 2-body orbit", function () {
        const G = 1;
        const softeningSq = 0;
        const dt = 0.001;
        const steps = 1000;
        const data = makeCircularOrbit(G, 1000, 1, 1);
        const e0 = computeTotalEnergy(data, 2, G, softeningSq);
        for (let s = 0; s < steps; s++) {
            const a0 = computeAccelerations(data, 2, G, softeningSq);
            applyYoshida4KickDrift(data, a0, 2, dt, 0);
            const a1 = computeAccelerations(data, 2, G, softeningSq);
            applyYoshida4KickDrift(data, a1, 2, dt, 1);
            const a2 = computeAccelerations(data, 2, G, softeningSq);
            applyYoshida4KickDrift(data, a2, 2, dt, 2);
            const a3 = computeAccelerations(data, 2, G, softeningSq);
            applyYoshida4KickDrift(data, a3, 2, dt, 3);
        }
        const eFinal = computeTotalEnergy(data, 2, G, softeningSq);
        const drift = Math.abs((eFinal - e0) / e0);
        expect(drift).toBeLessThan(0.001);
    });
});
