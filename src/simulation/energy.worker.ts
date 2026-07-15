const STRIDE = 7;

let allData: Float32Array;
let G = 2;
let softeningSq = 100;

self.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === "init") {
        allData = new Float32Array(msg.buffer);
        return;
    }
    if (msg.type === "data") {
        allData = msg.particles;
        return;
    }
    if (msg.type === "params") {
        G = msg.G;
        softeningSq = msg.softeningSq;
        return;
    }
    if (msg.type === "compute") {
        const count = allData.length / STRIDE;
        let kinetic = 0;
        let potential = 0;
        for (let i = 0; i < count; i++) {
            const i7 = i * STRIDE;
            const vx = allData[i7 + 3];
            const vy = allData[i7 + 4];
            const vz = allData[i7 + 5];
            const m = allData[i7 + 6];
            kinetic += 0.5 * m * (vx * vx + vy * vy + vz * vz);
        }
        for (let i = 0; i < count; i++) {
            const i7 = i * STRIDE;
            const px = allData[i7];
            const py = allData[i7 + 1];
            const pz = allData[i7 + 2];
            const mi = allData[i7 + 6];
            for (let j = i + 1; j < count; j++) {
                const j7 = j * STRIDE;
                const dx = allData[j7] - px;
                const dy = allData[j7 + 1] - py;
                const dz = allData[j7 + 2] - pz;
                const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
                const mj = allData[j7 + 6];
                potential -= (G * mi * mj) / Math.sqrt(distSq);
            }
        }
        const total = kinetic + potential;
        self.postMessage({ type: "energy", energy: total });
    }
};

export {};
