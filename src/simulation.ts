import { initializeGalaxy, STRIDE } from "./math/PhysicsEngine";
import { SimulationManager } from "./simulation/SimulationManager";
import {
    createWebGPUForce,
    computeAccelerationsWebGPU,
    WebGPUForce,
} from "./simulation/WebGPUForce";
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
let initialEnergy = 0;
let energyDrift = 0;
let lastEnergyCheck = performance.now();
let rotCurve: RotCurve;
let particleData: Float32Array;
let accelArray: Float32Array;

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
        particleData,
        config.gravitationalConstant,
        config.softeningEpsilon * config.softeningEpsilon,
    );
    initialEnergy = currentEnergy;
    energyDrift = 0;
    updateEnergyDisplay(0);
    lastEnergyCheck = performance.now();
}

export async function createSimulation(particleCount: number) {
    const initialData = initializeGalaxy(particleCount, GALAXY_RADIUS);
    const workerCount = navigator.hardwareConcurrency || 4;

    const gpuForce = await createWebGPUForce(
        initialData.buffer as SharedArrayBuffer,
        initialData.length / STRIDE,
    );
    if (gpuForce) {
        useGPU = true;
        webgpuForce = gpuForce;
        particleData = new Float32Array(initialData.buffer);
        accelArray = new Float32Array((particleData.length / STRIDE) * 3);
        if (simManager) {
            simManager.terminate();
            simManager = null;
        }
    } else {
        useGPU = false;
        if (simManager) simManager.terminate();
        simManager = new SimulationManager(initialData, workerCount);
        particleData = simManager.particleData;
        accelArray = new Float32Array((particleData.length / STRIDE) * 3);
        simManager.onUpdate = (data) => {
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
    resetEnergyBaseline();
    if (!rotCurve) rotCurve = new RotCurve();
}

let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = performance.now();
let rotCurveCounter = 0;

async function stepPhysics() {
    const effectiveDt = config.timeStep * config.timeScale;
    const subSteps = config.integrationSteps;
    const subDt = effectiveDt / subSteps;
    const count = particleData.length / STRIDE;
    const G = config.gravitationalConstant;
    const softSq = config.softeningEpsilon * config.softeningEpsilon;

    if (useGPU && webgpuForce) {
        for (let s = 0; s < subSteps; s++) {
            await computeAccelerationsWebGPU(webgpuForce, particleData, G, softSq, accelArray);
            applyFirstHalfKickAndDrift(particleData, accelArray, count, subDt);

            await computeAccelerationsWebGPU(webgpuForce, particleData, G, softSq, accelArray);
            applySecondHalfKick(particleData, accelArray, count, subDt);
        }
        particleSystem.update(particleData, config.particleSize, blackHoleIndex);
    } else if (simManager) {
        simManager.step({
            G,
            DT: effectiveDt,
            SOFTENING: config.softeningEpsilon,
            STEPS: subSteps,
        });
    }
}

export async function animationLoop() {
    requestAnimationFrame(animationLoop);
    if (!particleData || !particleSystem) return;

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
            particleData,
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

    if (!config.isPaused) {
        await stepPhysics();
    } else {
        particleSystem.update(particleData, config.particleSize, blackHoleIndex);
    }

    renderer.controls.update();
    postFX.render();

    rotCurveCounter++;
    if (rotCurveCounter % 15 === 0 && rotCurve && particleData) {
        rotCurve.update(particleData, GALAXY_RADIUS);
    }
}

export function setupResizeHandler() {
    window.addEventListener("resize", () => {
        renderer.onWindowResize();
        postFX.setSize(window.innerWidth, window.innerHeight);
    });
}

export function injectBlackHole() {
    const count = particleData.length / STRIDE;
    let newIndex = 0,
        maxDist = -Infinity;
    for (let i = 0; i < count; i++) {
        const idx = i * STRIDE;
        const x = particleData[idx],
            y = particleData[idx + 1],
            z = particleData[idx + 2];
        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist > maxDist) {
            maxDist = dist;
            newIndex = i;
        }
    }
    blackHoleIndex = newIndex;
    particleData[newIndex * STRIDE + 6] = config.blackHoleMass;
    particleData[newIndex * STRIDE + 3] = 0;
    particleData[newIndex * STRIDE + 4] = 0;
    particleData[newIndex * STRIDE + 5] = 0;
    if (simManager) {
        simManager.setBlackHoleIndex(blackHoleIndex);
        simManager.reset(particleData);
    }
    resetEnergyBaseline();
}

export function resetGalaxy() {
    createSimulation(config.particleCount).then(() => {
        blackHoleIndex = 0;
    });
}

export function getSimManager() {
    return simManager;
}
export function getParticleSystem() {
    return particleSystem;
}
