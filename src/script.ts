import "./style.css";
import {
    config,
    createSimulation,
    stepOnce,
    animationLoop,
    setupResizeHandler,
    injectBlackHole,
    resetGalaxy,
    getEnergyDrift,
} from "./simulation";
import { injectExplanations, setupModalAndTabs } from "./ui";
import { UIController } from "./visuals/UIController";

config.injectBlackHole = injectBlackHole;
config.resetGalaxy = resetGalaxy;

(async () => {
    if (window.location.search.includes("benchmark")) {
        await createSimulation(config.particleCount);
        console.log("Benchmark started with", config.particleCount, "particles.");
        let steps = 0;
        let lastTime = performance.now();
        let logTimer = performance.now();
        let totalSteps = 0;

        const loop = async () => {
            while (true) {
                await stepOnce();
                steps++;
                totalSteps++;
                const now = performance.now();
                if (now - logTimer >= 1000) {
                    const elapsed = (now - lastTime) / 1000;
                    const fps = steps / elapsed;
                    console.log(
                        `FPS: ${fps.toFixed(1)} | Steps: ${totalSteps} | Energy drift: ${getEnergyDrift().toFixed(4)}%`,
                    );
                    steps = 0;
                    lastTime = now;
                    logTimer = now;
                }
            }
        };
        loop();
    } else {
        await createSimulation(config.particleCount);
        new UIController(config);
        injectExplanations();
        setupModalAndTabs();
        setupResizeHandler();
        animationLoop();
    }
})();
