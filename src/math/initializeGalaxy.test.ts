import { describe, expect, it } from "vitest";
import { initializeGalaxy, STRIDE } from "./PhysicsEngine";
function computeCOM(data: Float32Array, count: number) {
    let totalMass = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let cvx = 0;
    let cvy = 0;
    let cvz = 0;
    for (let i = 0; i < count; i++) {
        const idx = i * STRIDE;
        const m = data[idx + 6];
        totalMass += m;
        cx += m * data[idx];
        cy += m * data[idx + 1];
        cz += m * data[idx + 2];
        cvx += m * data[idx + 3];
        cvy += m * data[idx + 4];
        cvz += m * data[idx + 5];
    }
    return {
        x: cx / totalMass,
        y: cy / totalMass,
        z: cz / totalMass,
        vx: cvx / totalMass,
        vy: cvy / totalMass,
        vz: cvz / totalMass,
    };
}
describe("initializeGalaxy centre of mass", function () {
    it("zeros COM position and velocity for 1000 particles", function () {
        const data = initializeGalaxy(1000, 100, 12345);
        const com = computeCOM(data, 1000);
        expect(Math.abs(com.x)).toBeLessThan(1e-6);
        expect(Math.abs(com.y)).toBeLessThan(1e-6);
        expect(Math.abs(com.z)).toBeLessThan(1e-6);
        expect(Math.abs(com.vx)).toBeLessThan(1e-6);
        expect(Math.abs(com.vy)).toBeLessThan(1e-6);
        expect(Math.abs(com.vz)).toBeLessThan(1e-6);
    });
    it("zeros COM position and velocity for 5000 particles", function () {
        const data = initializeGalaxy(5000, 100, 12345);
        const com = computeCOM(data, 5000);
        expect(Math.abs(com.x)).toBeLessThan(1e-6);
        expect(Math.abs(com.y)).toBeLessThan(1e-6);
        expect(Math.abs(com.z)).toBeLessThan(1e-6);
        expect(Math.abs(com.vx)).toBeLessThan(1e-6);
        expect(Math.abs(com.vy)).toBeLessThan(1e-6);
        expect(Math.abs(com.vz)).toBeLessThan(1e-6);
    });
    it("zeros COM for multiple seeds", function () {
        const seeds = [42, 7, 999];
        for (let s = 0; s < seeds.length; s++) {
            const data = initializeGalaxy(1000, 100, seeds[s]);
            const com = computeCOM(data, 1000);
            expect(Math.abs(com.x)).toBeLessThan(1e-6);
            expect(Math.abs(com.y)).toBeLessThan(1e-6);
            expect(Math.abs(com.z)).toBeLessThan(1e-6);
            expect(Math.abs(com.vx)).toBeLessThan(1e-6);
            expect(Math.abs(com.vy)).toBeLessThan(1e-6);
            expect(Math.abs(com.vz)).toBeLessThan(1e-6);
        }
    });
});
