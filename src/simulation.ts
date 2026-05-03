import { initializeGalaxy, STRIDE } from "./math/PhysicsEngine";
import { SimulationManager } from "./simulation/SimulationManager";
import { createWebGPUForce, computeFullStep, WebGPUForce } from "./simulation/WebGPUForce";
import { applyFirstHalfKickAndDrift, applySecondHalfKick } from "./simulation/leapfrog";
import { SceneRenderer } from "./visuals/SceneRenderer";
import { ParticleSystem } from "./visuals/ParticleSystem";
import { PostFX } from "./visuals/PostFX";
import { UIController, SimConfig } from "./visuals/UIController";
import { updateFPSDisplay, updateEnergyDisplay } from "./ui";
import { RotCurve } from "./visuals/RotCurve";
import { Vector2 } from "three";

const GALAXY_RADIUS = 400;

export const config: SimConfig = {
    gravitationalConstant: 2,
    softeningEpsilon: 10.0,
    blackHoleMass: 150000,
    timeStep: 0.016,
    integrationSteps: 2,
    bloomIntensity: 1.5,
    particleSize: 4.0,
    timeScale: 1.0,
    isPaused: false,
    autoRotate: true,
    particleCount: 6000,
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

function computeTotalEnergy(data: Float32Array, G: number, softeningSq: number): number {
    const count = data.length / STRIDE;
    let kinetic = 0,
        potential = 0;
    for (let i = 0; i < count; i++) {
        const i7 = i * STRIDE;
        const vx = data[i7 + 3],
            vy = data[i7 + 4],
            vz = data[i7 + 5],
            m = data[i7 + 6];
        kinetic += 0.5 * m * (vx * vx + vy * vy + vz * vz);
    }
    for (let i = 0; i < count; i++) {
        const i7 = i * STRIDE;
        const px = data[i7],
            py = data[i7 + 1],
            pz = data[i7 + 2],
            mi = data[i7 + 6];
        for (let j = i + 1; j < count; j++) {
            const j7 = j * STRIDE;
            const dx = data[j7] - px,
                dy = data[j7 + 1] - py,
                dz = data[j7 + 2] - pz;
            const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
            const mj = data[j7 + 6];
            potential -= (G * mi * mj) / Math.sqrt(distSq);
        }
    }
    return kinetic + potential;
}

function resetEnergyBaseline() {
    const currentEnergy = computeTotalEnergy(
        renderBuffer,
        config.gravitationalConstant,
        config.softeningEpsilon * config.softeningEpsilon,
    );
    initialEnergy = currentEnergy;
    energyDrift = 0;
    updateEnergyDisplay(0);
    lastEnergyCheck = performance.now();
}

function computeNucleusAccel(data: Float32Array) {
    const softSq = config.softeningEpsilon * config.softeningEpsilon;
    const G = config.gravitationalConstant;
    if (blackHoleActive) {
        const j7 = blackHoleIndex * STRIDE;
        const dx = data[j7];
        const dy = data[j7 + 1];
        const dz = data[j7 + 2];
        const mj = data[j7 + 6];
        const distSq = dx * dx + dy * dy + dz * dz + softSq;
        const invDist = 1 / Math.sqrt(distSq);
        const factor = G * mj * invDist * invDist * invDist;
        accelArray[0] = dx * factor;
        accelArray[1] = dy * factor;
        accelArray[2] = dz * factor;
    } else {
        accelArray[0] = 0;
        accelArray[1] = 0;
        accelArray[2] = 0;
    }
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

    const initialData = initializeGalaxy(particleCount, GALAXY_RADIUS);
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
    } else {
        useGPU = false;
        simManager = new SimulationManager(initialData, workerCount);
        renderBuffer = simManager.particleData;
        physicsBuffer = new Float32Array(initialData.length);
        accelArray = new Float32Array((renderBuffer.length / STRIDE) * 3);
        simManager.onUpdate = (data) => {
            renderBuffer = data;
            particleSystem.update(data, config.particleSize, blackHoleIndex);
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
    particleSystem = new ParticleSystem(particleCount);
    renderer.scene.add(particleSystem.points);
    renderer.scene.add(particleSystem.bulgePoints);
    renderer.scene.add(particleSystem.dustPoints);
    renderer.scene.add(particleSystem.haloPoints);
    if (particleSystem.blackHoleSprite) renderer.scene.add(particleSystem.blackHoleSprite);
    if (particleSystem.backgroundStars) renderer.scene.add(particleSystem.backgroundStars);

    blackHoleIndex = 0;
    blackHoleActive = false;
    physicsBusy = false;
    resetEnergyBaseline();
    if (!rotCurve) rotCurve = new RotCurve();
}

let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = performance.now();
let rotCurveCounter = 0;

function startPhysicsStep() {
    const effectiveDt = config.timeStep * config.timeScale;
    const subSteps = config.integrationSteps;
    const subDt = effectiveDt / subSteps;
    const count = renderBuffer.length / STRIDE;
    const G = config.gravitationalConstant;
    const softSq = config.softeningEpsilon * config.softeningEpsilon;

    physicsBusy = true;
    physicsBuffer.set(renderBuffer);

    (async () => {
        try {
            await computeFullStep(
                webgpuForce!,
                physicsBuffer,
                G,
                softSq,
                subDt,
                subSteps,
                physicsBuffer,
            );
            const tmp = renderBuffer;
            renderBuffer = physicsBuffer;
            physicsBuffer = tmp;
            particleSystem.update(renderBuffer, config.particleSize, blackHoleIndex);
            physicsBusy = false;
        } catch (e) {
            console.error("GPU physics step failed:", e);
            physicsBusy = false;
        }
    })();
}

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
    if (now - lastEnergyCheck > 500) {
        lastEnergyCheck = now;
        const currentEnergy = computeTotalEnergy(
            renderBuffer,
            config.gravitationalConstant,
            config.softeningEpsilon * config.softeningEpsilon,
        );
        energyDrift = Math.abs((currentEnergy - initialEnergy) / initialEnergy) * 100;
        updateEnergyDisplay(energyDrift);
    }
    const cameraPos = renderer.camera.position;
    const distToCenter = Math.sqrt(
        cameraPos.x * cameraPos.x + cameraPos.y * cameraPos.y + cameraPos.z * cameraPos.z,
    );
    const bloomFactor = 1.0 / (distToCenter / 300 + 1.0) + 0.3;
    postFX.setBloomIntensity(config.bloomIntensity * Math.max(0.5, bloomFactor));

    const bhPos = particleSystem.getBlackHoleWorldPos();
    if (bhPos) {
        const screenPos = bhPos.clone().project(renderer.camera);
        postFX.setLensingScreenPos(new Vector2((screenPos.x + 1) / 2, (-screenPos.y + 1) / 2), 1.2);
    } else {
        postFX.setLensingScreenPos(new Vector2(0.5, 0.5), 0.0);
    }

    renderer.controls.autoRotate = config.autoRotate && !config.isPaused;

    if (!config.isPaused && useGPU && !physicsBusy && !resetPending) {
        startPhysicsStep();
    } else if (!config.isPaused && !useGPU && simManager) {
        simManager.step({
            G: config.gravitationalConstant,
            DT: config.timeStep * config.timeScale,
            SOFTENING: config.softeningEpsilon,
            STEPS: config.integrationSteps,
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
    blackHoleIndex = newIndex;
    blackHoleActive = true;
    renderBuffer[newIndex * STRIDE + 6] = config.blackHoleMass;
    renderBuffer[newIndex * STRIDE + 3] = 0;
    renderBuffer[newIndex * STRIDE + 4] = 0;
    renderBuffer[newIndex * STRIDE + 5] = 0;
    if (useGPU) {
        physicsBuffer[newIndex * STRIDE + 6] = config.blackHoleMass;
        physicsBuffer[newIndex * STRIDE + 3] = 0;
        physicsBuffer[newIndex * STRIDE + 4] = 0;
        physicsBuffer[newIndex * STRIDE + 5] = 0;
    } else if (simManager) {
        simManager.setBlackHoleIndex(blackHoleIndex);
        simManager.setParticleMass(newIndex, config.blackHoleMass);
        simManager.particleData[newIndex * STRIDE + 3] = 0;
        simManager.particleData[newIndex * STRIDE + 4] = 0;
        simManager.particleData[newIndex * STRIDE + 5] = 0;
        simManager.reset(simManager.particleData);
    }
    resetEnergyBaseline();
}

export async function resetGalaxy() {
    resetPending = true;
    physicsBusy = false;
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
