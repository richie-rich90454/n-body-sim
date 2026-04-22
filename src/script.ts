import "./style.css";
import {
	config,
	createSimulation,
	animationLoop,
	setupResizeHandler,
	injectBlackHole,
	resetGalaxy,
} from "./simulation";
import { injectExplanations, setupModalAndTabs } from "./ui";
import { UIController } from "./visuals/UIController";

config.injectBlackHole = injectBlackHole;
config.resetGalaxy = resetGalaxy;

createSimulation(config.particleCount);

new UIController(config);

injectExplanations();
setupModalAndTabs();
setupResizeHandler();
animationLoop();
