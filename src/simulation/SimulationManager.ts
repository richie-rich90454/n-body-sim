import { STRIDE } from "../math/PhysicsEngine";

interface StepConfig {
    G: number;
    DT: number;
    SOFTENING: number;
    STEPS: number;
}

export class SimulationManager {
    private workers: Worker[] = [];
    private busyWorkers = 0;
    public particleData: Float32Array;
    public onUpdate: ((data: Float32Array) => void) | null = null;
    private pendingData: StepConfig | null = null;
    private resetRequested = false;
    private newDataAfterReset: Float32Array | null = null;
    private stepConfig: StepConfig | null = null;
    private stepIndex = 0;
    private stepPhase = 0;
    private subDt = 0;
    private stepInProgress = false;
    private accelArray: Float32Array;
    private count: number;

    constructor(initialData: Float32Array, workerCount: number) {
        this.count = initialData.length / STRIDE;
        const sab = new SharedArrayBuffer(initialData.length * Float32Array.BYTES_PER_ELEMENT);
        this.particleData = new Float32Array(sab);
        this.particleData.set(initialData);
        this.accelArray = new Float32Array(this.count * 3);

        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(new URL("./physics.worker.ts", import.meta.url), {
                type: "module",
            });
            worker.onmessage = this.handleWorkerMessage.bind(this);
            worker.postMessage({ type: "init", buffer: sab });
            this.workers.push(worker);
        }
    }

    private handleWorkerMessage(e: MessageEvent) {
        const { accel } = e.data;
        if (this.resetRequested) {
            this.busyWorkers--;
            if (this.busyWorkers === 0) this.finishReset();
            return;
        }
        if (accel && accel.length > 0) {
            const n = accel.length;
            for (let k = 0; k < n; k++) {
                this.accelArray[k] += accel[k];
            }
        }
        this.busyWorkers--;
        if (this.busyWorkers === 0) {
            this.onPhaseComplete();
        }
    }

    private onPhaseComplete() {
        if (this.stepPhase === 0) {
            const subDt = this.subDt;
            for (let i = 0; i < this.count; i++) {
                const i7 = i * STRIDE;
                const ax = this.accelArray[i * 3];
                const ay = this.accelArray[i * 3 + 1];
                const az = this.accelArray[i * 3 + 2];
                this.particleData[i7 + 3] += ax * subDt * 0.5;
                this.particleData[i7 + 4] += ay * subDt * 0.5;
                this.particleData[i7 + 5] += az * subDt * 0.5;
                this.particleData[i7] += this.particleData[i7 + 3] * subDt;
                this.particleData[i7 + 1] += this.particleData[i7 + 4] * subDt;
                this.particleData[i7 + 2] += this.particleData[i7 + 5] * subDt;
            }
            this.stepPhase = 1;
            this.dispatchAccelWorkers();
        } else {
            const subDt = this.subDt;
            for (let i = 0; i < this.count; i++) {
                const i7 = i * STRIDE;
                const ax = this.accelArray[i * 3];
                const ay = this.accelArray[i * 3 + 1];
                const az = this.accelArray[i * 3 + 2];
                this.particleData[i7 + 3] += ax * subDt * 0.5;
                this.particleData[i7 + 4] += ay * subDt * 0.5;
                this.particleData[i7 + 5] += az * subDt * 0.5;
            }
            this.stepIndex++;
            if (this.stepIndex < this.stepConfig!.STEPS) {
                this.startSubStep();
            } else {
                this.stepInProgress = false;
                if (this.onUpdate) this.onUpdate(this.particleData);
                if (this.pendingData) {
                    const next = this.pendingData;
                    this.pendingData = null;
                    this.startStep(next);
                }
            }
        }
    }

    private dispatchAccelWorkers() {
        const config = this.stepConfig!;
        const workerCount = this.workers.length;
        const chunkSize = Math.ceil(this.count / workerCount);
        this.busyWorkers = 0;
        this.accelArray.fill(0);
        for (let w = 0; w < workerCount; w++) {
            const startIdx = w * chunkSize;
            const endIdx = Math.min(startIdx + chunkSize, this.count);
            if (startIdx >= this.count) continue;
            this.busyWorkers++;
            this.workers[w].postMessage({
                type: "accel",
                startIdx,
                endIdx,
                count: this.count,
                G: config.G,
                softeningSq: config.SOFTENING * config.SOFTENING,
            });
        }
    }

    private startStep(config: StepConfig) {
        this.stepConfig = config;
        this.stepInProgress = true;
        this.stepIndex = 0;
        this.subDt = config.DT / config.STEPS;
        this.startSubStep();
    }

    private startSubStep() {
        this.stepPhase = 0;
        this.dispatchAccelWorkers();
    }

    private finishReset() {
        if (this.newDataAfterReset) {
            const sab = new SharedArrayBuffer(
                this.newDataAfterReset.length * Float32Array.BYTES_PER_ELEMENT,
            );
            this.particleData = new Float32Array(sab);
            this.particleData.set(this.newDataAfterReset);
            this.count = this.particleData.length / STRIDE;
            this.accelArray = new Float32Array(this.count * 3);
            this.newDataAfterReset = null;
            for (const w of this.workers) {
                w.postMessage({ type: "init", buffer: sab });
            }
        }
        this.resetRequested = false;
        this.stepInProgress = false;
        this.pendingData = null;
        if (this.onUpdate) this.onUpdate(this.particleData);
    }

    public step(config: StepConfig) {
        if (this.busyWorkers > 0 || this.stepInProgress) {
            this.pendingData = config;
            return;
        }
        if (this.resetRequested) return;
        this.startStep(config);
    }

    public setParticleMass(index: number, mass: number) {
        this.particleData[index * STRIDE + 6] = mass;
    }

    public reset(newData: Float32Array) {
        this.resetRequested = true;
        this.newDataAfterReset = newData;
        if (this.busyWorkers === 0 && !this.stepInProgress) this.finishReset();
    }

    public terminate() {
        this.workers.forEach((w) => w.terminate());
        this.workers = [];
        this.busyWorkers = 0;
        this.pendingData = null;
        this.resetRequested = false;
        this.stepInProgress = false;
    }
}
