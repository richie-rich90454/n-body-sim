import { describe, expect, it } from "vitest";
import { STRIDE } from "../math/PhysicsEngine";
import { computeTotalEnergy } from "./energy";
function makeThreeBody(): Float32Array {
    const data = new Float32Array(3 * STRIDE);
    data[6] = 1;
    data[7] = 1;
    data[10] = 1;
    data[13] = 2;
    data[15] = 2;
    data[18] = 1;
    data[19] = 1;
    data[20] = 3;
    return data;
}
describe("computeTotalEnergy (3-body hand-computed)", function () {
    it("matches the hand-computed softened kinetic plus potential energy", function () {
        const G = 2;
        const softeningSq = 4;
        const data = makeThreeBody();
        const total = computeTotalEnergy(data, 3, G, softeningSq);
        const expectedKE = 0.5 * 1 * 0 + 0.5 * 2 * (1 * 1) + 0.5 * 3 * (1 * 1 + 1 * 1);
        const expectedPE =
            -(G * 1 * 2) / Math.sqrt(1 + softeningSq) -
            (G * 1 * 3) / Math.sqrt(4 + softeningSq) -
            (G * 2 * 3) / Math.sqrt(5 + softeningSq);
        const expected = expectedKE + expectedPE;
        expect(total).toBeCloseTo(expected, 10);
    });
    it("matches the unsoftened Newtonian energy", function () {
        const G = 2;
        const softeningSq = 0;
        const data = makeThreeBody();
        const total = computeTotalEnergy(data, 3, G, softeningSq);
        const expectedKE = 0.5 * 2 * 1 + 0.5 * 3 * 2;
        const expectedPE =
            -(G * 1 * 2) / Math.sqrt(1) - (G * 1 * 3) / Math.sqrt(4) - (G * 2 * 3) / Math.sqrt(5);
        const expected = expectedKE + expectedPE;
        expect(total).toBeCloseTo(expected, 10);
    });
});
