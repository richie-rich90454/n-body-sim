import { STRIDE } from "../math/PhysicsEngine";

const TILE_SIZE = 256;

export interface WebGPUForce {
    device: GPUDevice;
    accelPipeline: GPUComputePipeline;
    leapfrog1Pipeline: GPUComputePipeline;
    leapfrog2Pipeline: GPUComputePipeline;
    bindGroupLayout: GPUBindGroupLayout;
    particleBuffer: GPUBuffer;
    accelBuffer: GPUBuffer;
    stateA: GPUBuffer;
    stateB: GPUBuffer;
    stagingBuffer: GPUBuffer;
    uniformBuffer: GPUBuffer;
    uniformWriteArray: Float32Array;
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
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const stateA = device.createBuffer({
        size: particleBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const stateB = device.createBuffer({
        size: particleBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const stagingBuffer = device.createBuffer({
        size: particleBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const uniformBuffer = device.createBuffer({
        size: 20,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformWriteArray = new Float32Array(5);

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" },
            },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        ],
    });

    const accelCode = `
@group(0) @binding(0) var<storage, read> particles: array<f32>;
@group(0) @binding(2) var<storage, read_write> accel: array<f32>;
@group(0) @binding(3) var<uniform> params: vec4<f32>;   // x=G, y=softeningSq, z=blackHoleIdx, w=unused
const STRIDE = 7u;
const TILE_SIZE = ${TILE_SIZE}u;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= ${count}u) { return; }

    var px = particles[i*STRIDE];
    var py = particles[i*STRIDE+1u];
    var pz = particles[i*STRIDE+2u];

    var ax = 0.0; var ay = 0.0; var az = 0.0;
    let G = params.x;
    let softeningSq = params.y;
    let blackHoleIdx = i32(params.z);

    let numTiles = (${count}u + TILE_SIZE - 1u) / TILE_SIZE;
    for (var t = 0u; t < numTiles; t++) {
        for (var jj = 0u; jj < TILE_SIZE; jj++) {
            let j = t*TILE_SIZE + jj;
            if (j >= ${count}u) { break; }
            if (i == j) { continue; }

            // Nucleus (i=0) only feels black hole if active
            if (i == 0u && blackHoleIdx >= 0i && j != u32(blackHoleIdx)) {
                continue;
            }

            let dx = particles[j*STRIDE] - px;
            let dy = particles[j*STRIDE+1u] - py;
            let dz = particles[j*STRIDE+2u] - pz;
            let mj = particles[j*STRIDE+6u];
            let distSq = dx*dx + dy*dy + dz*dz + softeningSq;
            let invDist = 1.0 / sqrt(distSq);
            let factor = G * mj * invDist * invDist * invDist;
            ax = ax + dx*factor;
            ay = ay + dy*factor;
            az = az + dz*factor;
        }
    }
    accel[i*3u]=ax; accel[i*3u+1u]=ay; accel[i*3u+2u]=az;
}
`;

    const leapfrog1Code = `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read> acc: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<uniform> params: vec4<f32>;   // z=dt, w=dtHalf
const STRIDE = 7u;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= ${count}u) { return; }
    let dt = params.z;
    let dtHalf = params.w;
    let base = i*STRIDE;
    let aBase = i*3u;
    let vx = src[base+3u] + acc[aBase]*dtHalf;
    let vy = src[base+4u] + acc[aBase+1u]*dtHalf;
    let vz = src[base+5u] + acc[aBase+2u]*dtHalf;
    dst[base+3u] = vx;
    dst[base+4u] = vy;
    dst[base+5u] = vz;
    dst[base] = src[base] + vx*dt;
    dst[base+1u] = src[base+1u] + vy*dt;
    dst[base+2u] = src[base+2u] + vz*dt;
    dst[base+6u] = src[base+6u];
}
`;

    const leapfrog2Code = `
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read> acc: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<uniform> params: vec4<f32>;   // w=dtHalf
const STRIDE = 7u;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    if (i >= ${count}u) { return; }
    let dtHalf = params.w;
    let base = i*STRIDE;
    let aBase = i*3u;
    dst[base+3u] = src[base+3u] + acc[aBase]*dtHalf;
    dst[base+4u] = src[base+4u] + acc[aBase+1u]*dtHalf;
    dst[base+5u] = src[base+5u] + acc[aBase+2u]*dtHalf;
    dst[base] = src[base];
    dst[base+1u] = src[base+1u];
    dst[base+2u] = src[base+2u];
    dst[base+6u] = src[base+6u];
}
`;

    const accelModule = device.createShaderModule({ code: accelCode });
    const leapfrog1Module = device.createShaderModule({ code: leapfrog1Code });
    const leapfrog2Module = device.createShaderModule({ code: leapfrog2Code });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    const accelPipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: accelModule, entryPoint: "main" },
    });
    const leapfrog1Pipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: leapfrog1Module, entryPoint: "main" },
    });
    const leapfrog2Pipeline = device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module: leapfrog2Module, entryPoint: "main" },
    });

    return {
        device,
        accelPipeline,
        leapfrog1Pipeline,
        leapfrog2Pipeline,
        bindGroupLayout,
        particleBuffer,
        accelBuffer,
        stateA,
        stateB,
        stagingBuffer,
        uniformBuffer,
        uniformWriteArray,
        count,
    };
}

export async function computeFullStep(
    force: WebGPUForce,
    particleData: Float32Array,
    G: number,
    softeningSq: number,
    subDt: number,
    subSteps: number,
    blackHoleIdx: number,
    outResult: Float32Array,
): Promise<void> {
    const {
        device,
        accelPipeline,
        leapfrog1Pipeline,
        leapfrog2Pipeline,
        bindGroupLayout,
        accelBuffer,
        stateA,
        stateB,
        stagingBuffer,
        uniformBuffer,
        uniformWriteArray,
        count,
    } = force;

    device.queue.writeBuffer(stateA, 0, particleData);

    uniformWriteArray[0] = G;
    uniformWriteArray[1] = softeningSq;
    uniformWriteArray[2] = subDt;
    uniformWriteArray[3] = subDt * 0.5;
    uniformWriteArray[4] = blackHoleIdx;
    device.queue.writeBuffer(uniformBuffer, 0, uniformWriteArray);

    const commandEncoder = device.createCommandEncoder();

    const createBindGroup = (srcBuf: GPUBuffer, accBuf: GPUBuffer, dstBuf: GPUBuffer) =>
        device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: srcBuf } },
                { binding: 1, resource: { buffer: accBuf } },
                { binding: 2, resource: { buffer: dstBuf } },
                { binding: 3, resource: { buffer: uniformBuffer } },
            ],
        });

    for (let s = 0; s < subSteps; s++) {
        {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(accelPipeline);
            pass.setBindGroup(0, createBindGroup(stateA, stateA, accelBuffer));
            pass.dispatchWorkgroups(Math.ceil(count / 256), 1, 1);
            pass.end();
        }
        {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(leapfrog1Pipeline);
            pass.setBindGroup(0, createBindGroup(stateA, accelBuffer, stateB));
            pass.dispatchWorkgroups(Math.ceil(count / 256), 1, 1);
            pass.end();
        }
        {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(accelPipeline);
            pass.setBindGroup(0, createBindGroup(stateB, stateB, accelBuffer));
            pass.dispatchWorkgroups(Math.ceil(count / 256), 1, 1);
            pass.end();
        }
        {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(leapfrog2Pipeline);
            pass.setBindGroup(0, createBindGroup(stateB, accelBuffer, stateA));
            pass.dispatchWorkgroups(Math.ceil(count / 256), 1, 1);
            pass.end();
        }
    }

    commandEncoder.copyBufferToBuffer(
        stateA,
        0,
        stagingBuffer,
        0,
        count * STRIDE * Float32Array.BYTES_PER_ELEMENT,
    );
    device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const mapped = stagingBuffer.getMappedRange();
    outResult.set(new Float32Array(mapped));
    stagingBuffer.unmap();
}
