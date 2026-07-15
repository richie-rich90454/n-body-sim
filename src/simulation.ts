import { initializeGalaxy, STRIDE } from "./math/PhysicsEngine";
import { SimulationManager } from "./simulation/SimulationManager";
import { createWebGPUForce, computeFullStep, WebGPUForce } from "./simulation/WebGPUForce";
import { SceneRenderer } from "./visuals/SceneRenderer";
import { ParticleSystem } from "./visuals/ParticleSystem";
import { PostFX } from "./visuals/PostFX";
import { UIController, SimConfig } from "./visuals/UIController";
import { updateFPSDisplay, updateEnergyDisplay } from "./ui";
import { RotCurve } from "./visuals/RotCurve";

const GALAXY_RADIUS = 400;

export const config: SimConfig = {
    gravitationalConstant: 2,
    softeningEpsilon: 10.0,
    blackHoleMass: 150000,
    timeStep: 0.016,
    integrationSteps: 2,
    integrator: "leapfrog",
    bloomIntensity: 1.5,
    particleSize: 4.0,
    timeScale: 1.0,
    isPaused: false,
    autoRotate: true,
    particleCount: 6000,
    seed: 12345,
    injectBlackHole: () => {},
    resetGalaxy: () => {},
};

const renderer = new SceneRenderer();
const postFX = new PostFX(renderer.renderer, renderer.scene, renderer.camera);

let particleSystem: ParticleSystem;
let simManager: SimulationManager | null = null;
let webgpuForce: WebGPUForce | null = null;
let useGPU = false;
let blackHoleIndex = 0;
let blackHoleActive = false;
let initialEnergy = 0;
let energyDrift = 0;
let lastEnergyCheck = performance.now();
let rotCurve: RotCurve;

let renderBuffer: Float32Array;
let physicsBuffer: Float32Array;
let accelArray: Float32Array;

let physicsBusy = false;
let resetPending = false;
let pendingInjection: { index: number; mass: number } | null = null;
let gpuNeedsUpload = true;

let energyWorker: Worker | null = null;
let energyPending = false;
let latestEnergy: number | null = null;

function sanitizeBuffer(data: Float32Array) {
    for (let i = 0; i < data.length; i++) {
        if (!Number.isFinite(data[i])) {
            data[i] = 0;
        }
    }
}

function initEnergyWorker(buffer: SharedArrayBuffer) {
    if (energyWorker) energyWorker.terminate();
    energyWorker = new Worker(new URL("./simulation/energy.worker.ts", import.meta.url), {
        type: "module",
    });
    energyWorker.postMessage({ type: "init", buffer });
    energyWorker.postMessage({
        type: "params",
        G: config.gravitationalConstant,
        softeningSq: config.softeningEpsilon * config.softeningEpsilon,
    });
    energyWorker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "energy") {
            latestEnergy = msg.energy;
            energyPending = false;
        }
    };
}

function requestEnergyCalculation() {
    if (!energyWorker || energyPending) return;
    energyPending = true;
    energyWorker.postMessage({ type: "compute" });
}

function resetEnergyBaseline() {
    if (!energyWorker) return;
    energyWorker.postMessage({
        type: "params",
        G: config.gravitationalConstant,
        softeningSq: config.softeningEpsilon * config.softeningEpsilon,
    });
    requestEnergyCalculation();
}

async function destroyWebGPU() {
    if (webgpuForce) {
        const { device } = webgpuForce;
        webgpuForce = null;
        device.destroy();
    }
}

export async function createSimulation(particleCount: number) {
    while (physicsBusy) {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
    await destroyWebGPU();
    if (simManager) {
        simManager.terminate();
        simManager = null;
    }

    const initialData = initializeGalaxy(particleCount, GALAXY_RADIUS, config.seed);
    const workerCount = navigator.hardwareConcurrency || 4;

    const gpuForce = await createWebGPUForce(
        initialData.buffer as SharedArrayBuffer,
        initialData.length / STRIDE,
    );
    if (gpuForce) {
        useGPU = true;
        webgpuForce = gpuForce;
        renderBuffer = new Float32Array(initialData);
        physicsBuffer = new Float32Array(initialData.length);
        accelArray = new Float32Array((physicsBuffer.length / STRIDE) * 3);
        gpuNeedsUpload = true;
    } else {
        useGPU = false;
        simManager = new SimulationManager(initialData, workerCount);
        renderBuffer = simManager.particleData;
        physicsBuffer = new Float32Array(initialData.length);
        accelArray = new Float32Array((renderBuffer.length / STRIDE) * 3);
        simManager.onUpdate = (data) => {
            sanitizeBuffer(data);
            renderBuffer = data;
            if (particleSystem) particleSystem.update(data, config.particleSize, blackHoleIndex);
        };
    }

    if (particleSystem) {
        renderer.scene.remove(particleSystem.points);
        renderer.scene.remove(particleSystem.bulgePoints);
        renderer.scene.remove(particleSystem.dustPoints);
        renderer.scene.remove(particleSystem.haloPoints);
        if (particleSystem.blackHoleSprite) renderer.scene.remove(particleSystem.blackHoleSprite);
        if (particleSystem.backgroundStars) renderer.scene.remove(particleSystem.backgroundStars);
        particleSystem.dispose();
    }
    if (typeof window !== "undefined" && !document.hidden) {
        particleSystem = new ParticleSystem(particleCount);
        renderer.scene.add(particleSystem.points);
        renderer.scene.add(particleSystem.bulgePoints);
        renderer.scene.add(particleSystem.dustPoints);
        renderer.scene.add(particleSystem.haloPoints);
        if (particleSystem.blackHoleSprite) renderer.scene.add(particleSystem.blackHoleSprite);
        if (particleSystem.backgroundStars) renderer.scene.add(particleSystem.backgroundStars);
    }

    const sharedBuf = (
        useGPU ? initialData.buffer : simManager!.particleData.buffer
    ) as SharedArrayBuffer;
    initEnergyWorker(sharedBuf);

    blackHoleIndex = 0;
    blackHoleActive = false;
    pendingInjection = null;
    physicsBusy = false;
    resetEnergyBaseline();
    if (!rotCurve && particleSystem) rotCurve = new RotCurve();
}

export async function stepOnce(): Promise<void> {
    if (resetPending || !renderBuffer) return;
    if (physicsBusy) return;

    const effectiveDt = config.timeStep * config.timeScale;
    const subSteps = config.integrationSteps;
    const subDt = effectiveDt / subSteps;
    const count = renderBuffer.length / STRIDE;
    const G = config.gravitationalConstant;
    const softSq = config.softeningEpsilon * config.softeningEpsilon;

    if (pendingInjection) {
        const { index, mass } = pendingInjection;
        blackHoleIndex = index;
        blackHoleActive = true;
        renderBuffer[index * STRIDE + 6] = mass;
        renderBuffer[index * STRIDE + 3] = 0;
        renderBuffer[index * STRIDE + 4] = 0;
        renderBuffer[index * STRIDE + 5] = 0;
        physicsBuffer[index * STRIDE + 6] = mass;
        physicsBuffer[index * STRIDE + 3] = 0;
        physicsBuffer[index * STRIDE + 4] = 0;
        physicsBuffer[index * STRIDE + 5] = 0;
        if (!useGPU && simManager) {
            simManager.setParticleMass(index, mass);
            simManager.particleData[index * STRIDE + 3] = 0;
            simManager.particleData[index * STRIDE + 4] = 0;
            simManager.particleData[index * STRIDE + 5] = 0;
            simManager.reset(simManager.particleData);
        }
        pendingInjection = null;
        resetEnergyBaseline();
        gpuNeedsUpload = true;
    }

    physicsBusy = true;
    physicsBuffer.set(renderBuffer);

    if (useGPU && webgpuForce) {
        await computeFullStep(
            webgpuForce,
            physicsBuffer,
            G,
            softSq,
            subDt,
            subSteps,
            physicsBuffer,
            config.integrator,
            true,
        );
        sanitizeBuffer(physicsBuffer);
        const tmp = renderBuffer;
        renderBuffer = physicsBuffer;
        physicsBuffer = tmp;
        if (particleSystem)
            particleSystem.update(renderBuffer, config.particleSize, blackHoleIndex);
        physicsBusy = false;
    } else if (!useGPU && simManager) {
        simManager.step({
            G,
            DT: effectiveDt,
            SOFTENING: config.softeningEpsilon,
            STEPS: subSteps,
            INTEGRATOR: config.integrator,
        });
        physicsBusy = false;
    }
}

let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = performance.now();
let rotCurveCounter = 0;

export function animationLoop() {
    requestAnimationFrame(animationLoop);
    if (!renderBuffer || !particleSystem) return;

    const now = performance.now();
    const deltaTime = Math.min(now - lastTime, 100);
    lastTime = now;
    frameCount++;
    if (now - fpsTimer >= 200) {
        const fps = Math.round((frameCount * 1000) / (now - fpsTimer));
        frameCount = 0;
        fpsTimer = now;
        updateFPSDisplay(fps.toString(), deltaTime.toFixed(2));
    }

    if (latestEnergy !== null) {
        const currentEnergy = latestEnergy;
        latestEnergy = null;
        if (initialEnergy === 0) {
            initialEnergy = currentEnergy;
            energyDrift = 0;
            updateEnergyDisplay(0);
        } else {
            energyDrift = Math.abs((currentEnergy - initialEnergy) / initialEnergy) * 100;
        }
        updateEnergyDisplay(energyDrift);
    }

    if (now - lastEnergyCheck > 500) {
        lastEnergyCheck = now;
        requestEnergyCalculation();
    }

    const cameraPos = renderer.camera.position;
    const distToCenter = Math.sqrt(
        cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y + cameraPos.z * cameraPos.z,
    );
    const bloomFactor = 1.0 / (distToCenter / 300 + 1.0) + 0.3;
    postFX.setBloomIntensity(config.bloomIntensity * Math.max(0.5, bloomFactor));

    renderer.controls.autoRotate = config.autoRotate && !config.isPaused;

    if (!config.isPaused && useGPU && !physicsBusy && !resetPending) {
        const effectiveDt = config.timeStep * config.timeScale;
        const subSteps = config.integrationSteps;
        const subDt = effectiveDt / subSteps;
        const count = renderBuffer.length / STRIDE;
        const G = config.gravitationalConstant;
        const softSq = config.softeningEpsilon * config.softeningEpsilon;

        if (pendingInjection) {
            const { index, mass } = pendingInjection;
            blackHoleIndex = index;
            blackHoleActive = true;
            renderBuffer[index * STRIDE + 6] = mass;
            renderBuffer[index * STRIDE + 3] = 0;
            renderBuffer[index * STRIDE + 4] = 0;
            renderBuffer[index * STRIDE + 5] = 0;
            physicsBuffer[index * STRIDE + 6] = mass;
            physicsBuffer[index * STRIDE + 3] = 0;
            physicsBuffer[index * STRIDE + 4] = 0;
            physicsBuffer[index * STRIDE + 5] = 0;
            if (!useGPU && simManager) {
                simManager.setParticleMass(index, mass);
                simManager.particleData[index * STRIDE + 3] = 0;
                simManager.particleData[index * STRIDE + 4] = 0;
                simManager.particleData[index * STRIDE + 5] = 0;
                simManager.reset(simManager.particleData);
            }
            pendingInjection = null;
            resetEnergyBaseline();
            gpuNeedsUpload = true;
        }

        physicsBusy = true;
        const uploadData: Float32Array | null = gpuNeedsUpload ? physicsBuffer : null;
        if (gpuNeedsUpload) {
            physicsBuffer.set(renderBuffer);
        }

        (async () => {
            try {
                const gotResult = await computeFullStep(
                    webgpuForce!,
                    uploadData,
                    G,
                    softSq,
                    subDt,
                    subSteps,
                    physicsBuffer,
                    config.integrator,
                    false,
                );
                gpuNeedsUpload = false;
                if (gotResult) {
                    sanitizeBuffer(physicsBuffer);
                    const tmp = renderBuffer;
                    renderBuffer = physicsBuffer;
                    physicsBuffer = tmp;
                    particleSystem.update(renderBuffer, config.particleSize, blackHoleIndex);
                }
                physicsBusy = false;
            } catch (e) {
                console.error("GPU physics step failed:", e);
                physicsBusy = false;
            }
        })();
    } else if (!config.isPaused && !useGPU && simManager) {
        simManager.step({
            G: config.gravitationalConstant,
            DT: config.timeStep * config.timeScale,
            SOFTENING: config.softeningEpsilon,
            STEPS: config.integrationSteps,
            INTEGRATOR: config.integrator,
        });
    }

    renderer.controls.update();
    postFX.render();

    rotCurveCounter++;
    if (rotCurveCounter % 15 === 0 && rotCurve && renderBuffer) {
        rotCurve.update(renderBuffer, GALAXY_RADIUS);
    }
}

export function setupResizeHandler() {
    window.addEventListener("resize", () => {
        renderer.onWindowResize();
        postFX.setSize(window.innerWidth, window.innerHeight);
    });
}

export function injectBlackHole() {
    const count = renderBuffer.length / STRIDE;
    let newIndex = 0,
        maxDist = -Infinity;
    for (let i = 0; i < count; i++) {
        const idx = i * STRIDE;
        const x = renderBuffer[idx],
            y = renderBuffer[idx + 1],
            z = renderBuffer[idx + 2];
        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist > maxDist) {
            maxDist = dist;
            newIndex = i;
        }
    }
    pendingInjection = { index: newIndex, mass: config.blackHoleMass };
}

export async function resetGalaxy() {
    resetPending = true;
    physicsBusy = false;
    pendingInjection = null;
    while (physicsBusy) {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
    await createSimulation(config.particleCount);
    blackHoleIndex = 0;
    blackHoleActive = false;
    resetPending = false;
}

export function getSimManager() {
    return simManager;
}
export function getParticleSystem() {
    return particleSystem;
}
export function getEnergyDrift(): number {
    return energyDrift;
}
