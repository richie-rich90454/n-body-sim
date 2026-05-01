import { initializeGalaxy, STRIDE } from "./math/PhysicsEngine";
import { SimulationManager } from "./simulation/SimulationManager";
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
let simManager: SimulationManager;
let blackHoleIndex = 0;
let initialEnergy = 0;
let energyDrift = 0;
let lastEnergyCheck = performance.now();
let rotCurve: RotCurve;

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
        simManager.particleData,
        config.gravitationalConstant,
        config.softeningEpsilon * config.softeningEpsilon,
    );
    initialEnergy = currentEnergy;
    energyDrift = 0;
    updateEnergyDisplay(0);
    lastEnergyCheck = performance.now();
}

export function createSimulation(particleCount: number) {
    const initialData = initializeGalaxy(particleCount, GALAXY_RADIUS);
    const workerCount = navigator.hardwareConcurrency || 4;
    if (simManager) simManager.terminate();
    simManager = new SimulationManager(initialData, workerCount);
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
    simManager.onUpdate = (data) => {
        particleSystem.update(data, config.particleSize, blackHoleIndex);
    };
    blackHoleIndex = 0;
    resetEnergyBaseline();
    if (!rotCurve) rotCurve = new RotCurve();
}

let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = performance.now();
let rotCurveCounter = 0;

export function animationLoop() {
    requestAnimationFrame(animationLoop);
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
            simManager.particleData,
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
        const effectiveDt = config.timeStep * config.timeScale;
        simManager.step({
            G: config.gravitationalConstant,
            DT: effectiveDt,
            SOFTENING: config.softeningEpsilon,
            STEPS: config.integrationSteps,
        });
    } else {
        if (simManager.onUpdate) simManager.onUpdate(simManager.particleData);
    }
    renderer.controls.update();
    postFX.render();

    rotCurveCounter++;
    if (rotCurveCounter % 15 === 0 && rotCurve) {
        rotCurve.update(simManager.particleData, GALAXY_RADIUS);
    }
}

export function setupResizeHandler() {
    window.addEventListener("resize", () => {
        renderer.onWindowResize();
        postFX.setSize(window.innerWidth, window.innerHeight);
    });
}

export function injectBlackHole() {
    const count = simManager.particleData.length / STRIDE;
    let newIndex = 0,
        maxDist = -Infinity;
    for (let i = 0; i < count; i++) {
        const idx = i * STRIDE;
        const x = simManager.particleData[idx],
            y = simManager.particleData[idx + 1],
            z = simManager.particleData[idx + 2];
        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist > maxDist) {
            maxDist = dist;
            newIndex = i;
        }
    }
    blackHoleIndex = newIndex;
    simManager.setBlackHoleIndex(blackHoleIndex);
    simManager.setParticleMass(blackHoleIndex, config.blackHoleMass);
    const idx = blackHoleIndex * STRIDE;
    simManager.particleData[idx + 3] = 0;
    simManager.particleData[idx + 4] = 0;
    simManager.particleData[idx + 5] = 0;
    simManager.reset(simManager.particleData);
    resetEnergyBaseline();
}

export function resetGalaxy() {
    createSimulation(config.particleCount);
    blackHoleIndex = 0;
    simManager.setBlackHoleIndex(0);
}

export function getSimManager() {
    return simManager;
}
export function getParticleSystem() {
    return particleSystem;
}
