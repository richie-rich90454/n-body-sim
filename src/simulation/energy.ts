import { STRIDE } from "../math/PhysicsEngine";

export function computeTotalEnergy(
    data: Float32Array,
    count: number,
    G: number,
    softeningSq: number,
): number {
    let kinetic = 0;
    let potential = 0;
    for (let i = 0; i < count; i++) {
        const i7 = i * STRIDE;
        const vx = data[i7 + 3];
        const vy = data[i7 + 4];
        const vz = data[i7 + 5];
        const m = data[i7 + 6];
        kinetic += 0.5 * m * (vx * vx + vy * vy + vz * vz);
    }
    for (let i = 0; i < count; i++) {
        const i7 = i * STRIDE;
        const px = data[i7];
        const py = data[i7 + 1];
        const pz = data[i7 + 2];
        const mi = data[i7 + 6];
        for (let j = i + 1; j < count; j++) {
            const j7 = j * STRIDE;
            const dx = data[j7] - px;
            const dy = data[j7 + 1] - py;
            const dz = data[j7 + 2] - pz;
            const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
            const mj = data[j7 + 6];
            potential -= (G * mi * mj) / Math.sqrt(distSq);
        }
    }
    return kinetic + potential;
}
