import { STRIDE } from "../math/PhysicsEngine";
import { computeTotalEnergy } from "./energy";

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
        const total = computeTotalEnergy(allData, count, G, softeningSq);
        self.postMessage({ type: "energy", energy: total });
    }
};

export {};
