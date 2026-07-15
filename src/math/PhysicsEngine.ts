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
    const a = 30;
    const b = 5;
    const softening = 10;
    const diskScaleLength = 70;
    const diskScaleHeight = 5;

    const uniformMass = diskMass / (particleCount - 1);
    const vCirc = (r: number): number => {
        const v2_cen = (G * centralMass) / (r + softening);
        const denom = r * r + (a + b) * (a + b);
        const v2_disk = (G * diskMass * r * r) / (denom * Math.sqrt(denom));
        return Math.sqrt(v2_cen + v2_disk);
    };
    const expTrunc = 1 - Math.exp(-radius / diskScaleLength);
    const gauss = (sigma: number): number => {
        const u1 = Math.max(rng(), 1e-12);
        const u2 = rng();
        return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
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
        const u = rng();
        const r = -diskScaleLength * Math.log(1 - u * expTrunc);
        const theta = rng() * Math.PI * 2;

        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        const z = gauss(diskScaleHeight);

        data[idx] = x;
        data[idx + 1] = y;
        data[idx + 2] = z;

        const vc = vCirc(r);
        const sigmaR = 0.18 * vc;
        const sigmaT = sigmaR * 0.7071067811865475;
        const sigmaZ = 0.08 * vc;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const vRadial = gauss(sigmaR);
        const vTang = gauss(sigmaT);
        const vZ = gauss(sigmaZ);

        const vx = -vc * sinT + cosT * vRadial + -sinT * vTang;
        const vy = vc * cosT + sinT * vRadial + cosT * vTang;

        data[idx + 3] = vx;
        data[idx + 4] = vy;
        data[idx + 5] = vZ;
        data[idx + 6] = uniformMass;
    }
    return data;
}
