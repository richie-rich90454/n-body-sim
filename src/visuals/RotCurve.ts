import { STRIDE } from "../math/PhysicsEngine";

export class RotCurve {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width = 200;
    private height = 150;
    private maxRadius = 400;
    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.position = "absolute";
        this.canvas.style.bottom = "60px";
        this.canvas.style.left = "20px";
        this.canvas.style.background = "rgba(10,20,30,0.6)";
        this.canvas.style.border = "1px solid rgba(100,180,255,0.3)";
        this.canvas.style.borderRadius = "4px";
        this.canvas.style.pointerEvents = "none";
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d")!;
    }

    public update(data: Float32Array, maxRadius: number) {
        const bins = 40;
        const binSize = this.maxRadius / bins;
        const sumV = new Float32Array(bins);
        const countV = new Uint32Array(bins);
        const count = data.length / STRIDE;

        for (let i = 0; i < count; i++) {
            const base = i * STRIDE;
            const x = data[base],
                y = data[base + 1],
                z = data[base + 2];
            const vx = data[base + 3],
                vy = data[base + 4],
                vz = data[base + 5];
            const r = Math.sqrt(x * x + y * y + z * z);

            if (r > this.maxRadius) continue;

            if (i === 0) continue;

            if (!isFinite(vx) || !isFinite(vy) || !isFinite(vz)) continue;

            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            const tang = r > 0.01 ? Math.abs((x * vy - y * vx) / (r * r + 0.001)) : 0;

            const tangCapped = Math.min(tang, speed * 3);

            const bin = Math.min(bins - 1, Math.floor(r / binSize));
            sumV[bin] += tangCapped;
            countV[bin]++;
        }

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.strokeStyle = "rgba(180,220,255,0.8)";
        ctx.beginPath();
        ctx.moveTo(10, this.height - 10);
        ctx.lineTo(this.width - 10, this.height - 10);
        ctx.moveTo(10, 10);
        ctx.lineTo(10, this.height - 10);
        ctx.stroke();

        let maxVel = 0;
        for (let i = 0; i < bins; i++) {
            if (countV[i] > 0) {
                const avg = sumV[i] / countV[i];
                if (avg > maxVel) maxVel = avg;
            }
        }
        if (maxVel < 0.01) maxVel = 0.01;

        const graphH = this.height - 20;
        const graphW = this.width - 20;
        ctx.fillStyle = "rgba(140,200,255,0.7)";
        for (let i = 0; i < bins; i++) {
            if (countV[i] === 0) continue;
            const avg = sumV[i] / countV[i];
            const x = 10 + (i / (bins - 1)) * graphW;
            const y = this.height - 10 - (avg / maxVel) * graphH;
            ctx.fillRect(x - 1, y - 1, 2, 2);
        }

        ctx.fillStyle = "rgba(180,220,255,0.9)";
        ctx.font = "8px monospace";
        ctx.fillText("v", 12, 15);
        ctx.fillText("R", this.width - 12, this.height - 12);
    }
}