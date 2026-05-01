import { STRIDE } from "../math/PhysicsEngine";

const TILE_SIZE = 256;

export interface WebGPUForce {
    device: GPUDevice;
    pipeline: GPUComputePipeline;
    bindGroupLayout: GPUBindGroupLayout;
    bindGroup: GPUBindGroup;
    particleBuffer: GPUBuffer;
    accelBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    stagingBuffers: [GPUBuffer, GPUBuffer];
    stagingReady: [boolean, boolean];
    stagingIndex: number;
    count: number;
}

export async function createWebGPUForce(
    particleData: SharedArrayBuffer,
    count: number,
): Promise<WebGPUForce | null> {
    if (!("gpu" in navigator)) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    if (!device) return null;

    const particleBufferSize = count * STRIDE * Float32Array.BYTES_PER_ELEMENT;
    const accelBufferSize = count * 3 * Float32Array.BYTES_PER_ELEMENT;

    const particleBuffer = device.createBuffer({
        size: particleBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(particleBuffer, 0, new Float32Array(particleData));

    const accelBuffer = device.createBuffer({
        size: accelBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const uniformBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const staging0 = device.createBuffer({
        size: accelBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const staging1 = device.createBuffer({
        size: accelBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" },
            },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        ],
    });

    const shaderCode = `
        @group(0) @binding(0) var<storage, read> particles: array<f32>;
        @group(0) @binding(1) var<storage, read_write> accel: array<f32>;
        @group(0) @binding(2) var<uniform> params: vec2<f32>;

        const STRIDE = 7u;
        const TILE_SIZE = ${TILE_SIZE}u;

        @compute @workgroup_size(256, 1, 1)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            let i = id.x;
            if (i >= ${count}u) { return; }

            var px = particles[i * STRIDE];
            var py = particles[i * STRIDE + 1u];
            var pz = particles[i * STRIDE + 2u];

            var ax = 0.0;
            var ay = 0.0;
            var az = 0.0;

            let G = params.x;
            let softeningSq = params.y;

            let numTiles = (${count}u + TILE_SIZE - 1u) / TILE_SIZE;
            for (var t = 0u; t < numTiles; t++) {
                for (var jj = 0u; jj < TILE_SIZE; jj++) {
                    let j = t * TILE_SIZE + jj;
                    if (j >= ${count}u) { break; }
                    if (i == j) { continue; }

                    let dx = particles[j * STRIDE] - px;
                    let dy = particles[j * STRIDE + 1u] - py;
                    let dz = particles[j * STRIDE + 2u] - pz;
                    let mj = particles[j * STRIDE + 6u];

                    let distSq = dx * dx + dy * dy + dz * dz + softeningSq;
                    let invDist = 1.0 / sqrt(distSq);
                    let factor = G * mj * invDist * invDist * invDist;

                    ax = ax + dx * factor;
                    ay = ay + dy * factor;
                    az = az + dz * factor;
                }
            }

            accel[i * 3u] = ax;
            accel[i * 3u + 1u] = ay;
            accel[i * 3u + 2u] = az;
        }
    `;

    const shaderModule = device.createShaderModule({ code: shaderCode });
    const pipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        compute: { module: shaderModule, entryPoint: "main" },
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: accelBuffer } },
            { binding: 2, resource: { buffer: uniformBuffer } },
        ],
    });

    return {
        device,
        pipeline,
        bindGroupLayout,
        bindGroup,
        particleBuffer,
        accelBuffer,
        uniformBuffer,
        stagingBuffers: [staging0, staging1],
        stagingReady: [true, true],
        stagingIndex: 0,
        count,
    };
}

export async function computeAccelerationsWebGPU(
    force: WebGPUForce,
    particleData: Float32Array,
    G: number,
    softeningSq: number,
): Promise<Float32Array> {
    const {
        device,
        pipeline,
        particleBuffer,
        accelBuffer,
        uniformBuffer,
        stagingBuffers,
        stagingReady,
        bindGroup,
        count,
    } = force;

    device.queue.writeBuffer(particleBuffer, 0, particleData);
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([G, softeningSq]));

    while (!stagingReady[0] && !stagingReady[1]) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const idx = stagingReady[0] ? 0 : 1;
    stagingReady[idx] = false;
    const staging = stagingBuffers[idx];

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(count / 256), 1, 1);
    passEncoder.end();

    commandEncoder.copyBufferToBuffer(
        accelBuffer,
        0,
        staging,
        0,
        count * 3 * Float32Array.BYTES_PER_ELEMENT,
    );

    device.queue.submit([commandEncoder.finish()]);

    await staging.mapAsync(GPUMapMode.READ);
    const mapped = staging.getMappedRange();
    const result = new Float32Array(mapped.slice(0));
    staging.unmap();
    stagingReady[idx] = true;

    return result;
}
