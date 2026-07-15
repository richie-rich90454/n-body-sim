export const STRIDE = 7;
export const DEFAULT_SEED = 12345;

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function initializeGalaxy(
    particleCount: number,
    radius: number,
    seed: number = DEFAULT_SEED,
): Float32Array {
    const data = new Float32Array(particleCount * STRIDE);
    const rng = mulberry32(seed);

    const G = 2.0;
    const centralMass = 20000;
    const diskMass = 50000;
    const haloVmax = 4.0;
    const haloCoreRadius = 80;
    const a = 30;
    const b = 5;
    const softening = 10;

    const uniformMass = diskMass / particleCount;
    const vCirc = (r: number): number => {
        const v2_cen = (G * centralMass) / (r + softening);
        const denom = r * r + (a + b) * (a + b);
        const v2_disk = (G * diskMass * r * r) / (denom * Math.sqrt(denom));
        const v2_halo = (haloVmax * haloVmax * (r * r)) / (r * r + haloCoreRadius * haloCoreRadius);
        return Math.sqrt(v2_cen + v2_disk + v2_halo);
    };

    for (let i = 0; i < particleCount; i++) {
        const idx = i * STRIDE;
        if (i === 0) {
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 0;
            data[idx + 4] = 0;
            data[idx + 5] = 0;
            data[idx + 6] = centralMass;
            continue;
        }
        const r = Math.pow(rng(), 1.5) * radius;
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi) * 0.4;

        data[idx] = x;
        data[idx + 1] = y;
        data[idx + 2] = z;

        const vc = vCirc(r);
        const speed = vc;

        const vx = -speed * Math.sin(theta);
        const vy = speed * Math.cos(theta);
        const vz = 0;

        data[idx + 3] = vx;
        data[idx + 4] = vy;
        data[idx + 5] = vz;
        data[idx + 6] = uniformMass;
    }
    return data;
}
