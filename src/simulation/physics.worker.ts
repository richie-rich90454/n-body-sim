import { computeAccelerations } from "../math/force";
let sharedData: Float32Array | null = null;

self.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === "init") {
        sharedData = new Float32Array(msg.buffer);
        return;
    }
    if (msg.type === "accel") {
        const { startIdx, endIdx, count, G, softeningSq } = msg;
        const data: Float32Array = msg.particles ? msg.particles : (sharedData as Float32Array);
        const accel = computeAccelerations(data, count, G, softeningSq, startIdx, endIdx);
        self.postMessage({ accel, startIdx }, { transfer: [accel.buffer] });
    }
};

export {};
