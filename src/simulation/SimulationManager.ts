import { STRIDE } from "../math/PhysicsEngine";

interface WorkerMessage {
	slice: Float32Array;
	startIdx: number;
}

export class SimulationManager {
	private workers: Worker[] = [];
	private busyWorkers = 0;
	public particleData: Float32Array;
	public onUpdate: ((data: Float32Array) => void) | null = null;
	private pendingData: any = null;
	private resetRequested = false;
	private newDataAfterReset: Float32Array | null = null;

	constructor(initialData: Float32Array, workerCount: number) {
		this.particleData = new Float32Array(initialData);
		for (let i = 0; i < workerCount; i++) {
			const worker = new Worker(new URL("./physics.worker.ts", import.meta.url), {
				type: "module",
			});
			worker.onmessage = this.handleWorkerMessage.bind(this, i);
			this.workers.push(worker);
		}
	}

	private handleWorkerMessage(workerIndex: number, e: MessageEvent<WorkerMessage>) {
		const { slice, startIdx } = e.data;
		if (this.resetRequested) {
			this.busyWorkers--;
			if (this.busyWorkers === 0) {
				this.finishReset();
			}
			return;
		}
		this.particleData.set(slice, startIdx * STRIDE);
		this.busyWorkers--;
		if (this.busyWorkers === 0) {
			if (this.onUpdate) {
				this.onUpdate(this.particleData);
			}
			if (this.pendingData) {
				this.step(this.pendingData);
				this.pendingData = null;
			}
		}
	}

	private finishReset() {
		if (this.newDataAfterReset) {
			this.particleData = new Float32Array(this.newDataAfterReset);
			this.newDataAfterReset = null;
		}
		this.resetRequested = false;
		this.pendingData = null;
		if (this.onUpdate) {
			this.onUpdate(this.particleData);
		}
	}

	public step(config: any) {
		if (this.busyWorkers > 0) {
			this.pendingData = config;
			return;
		}
		if (this.resetRequested) return;
		const count = this.particleData.length / STRIDE;
		const workerCount = this.workers.length;
		const chunkSize = Math.ceil(count / workerCount);
		this.busyWorkers = workerCount;
		for (let w = 0; w < workerCount; w++) {
			const startIdx = w * chunkSize;
			const endIdx = Math.min(startIdx + chunkSize, count);
			if (startIdx >= count) {
				this.busyWorkers--;
				continue;
			}
			const length = (endIdx - startIdx) * STRIDE;
			const chunk = new Float32Array(this.particleData.buffer, startIdx * STRIDE * 4, length);
			const slice = new Float32Array(length);
			slice.set(chunk);
			this.workers[w].postMessage(
				{
					myData: slice,
					allData: this.particleData,
					startIdx,
					endIdx,
					count,
					G: config.G,
					DT: config.DT,
					SOFTENING: config.SOFTENING,
					STEPS: config.STEPS,
				},
				[slice.buffer],
			);
		}
	}

	public setParticleMass(index: number, mass: number) {
		this.particleData[index * STRIDE + 6] = mass;
	}

	public reset(newData: Float32Array) {
		this.resetRequested = true;
		this.newDataAfterReset = newData;
		if (this.busyWorkers === 0) {
			this.finishReset();
		}
	}

	public terminate() {
		this.workers.forEach((w) => w.terminate());
		this.workers = [];
		this.busyWorkers = 0;
		this.pendingData = null;
		this.resetRequested = false;
	}
}
