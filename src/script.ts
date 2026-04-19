import { initializeGalaxy, STRIDE } from "./math/PhysicsEngine";
import { SimulationManager } from "./simulation/SimulationManager";
import { SceneRenderer } from "./visuals/SceneRenderer";
import { ParticleSystem } from "./visuals/ParticleSystem";
import { PostFX } from "./visuals/PostFX";
import { UIController, SimConfig } from "./visuals/UIController";
import katex from "katex";
import "katex/dist/katex.min.css";

const GALAXY_RADIUS = 400;

const config: SimConfig = {
	gravitationalConstant: 0.5,
	softeningEpsilon: 10.0,
	blackHoleMass: 150000,
	timeStep: 0.016,
	integrationSteps: 2,
	bloomIntensity: 1.2,
	particleSize: 1.8,
	timeScale: 1.0,
	isPaused: false,
	particleCount: 6000,
	injectBlackHole: () => {},
	resetGalaxy: () => {},
};

const renderer = new SceneRenderer();
const postFX = new PostFX(renderer.renderer, renderer.scene, renderer.camera);

let particleSystem: ParticleSystem;
let simManager: SimulationManager;

function createSimulation(particleCount: number) {
	const initialData = initializeGalaxy(particleCount, GALAXY_RADIUS);
	const workerCount = navigator.hardwareConcurrency || 4;
	if (simManager) {
		simManager.terminate();
	}
	simManager = new SimulationManager(initialData, workerCount);
	if (particleSystem) {
		renderer.scene.remove(particleSystem.points);
		particleSystem.dispose();
	}
	particleSystem = new ParticleSystem(particleCount);
	renderer.scene.add(particleSystem.points);
	simManager.onUpdate = (data) => {
		particleSystem.update(data, config.particleSize);
	};
	if (particleSystem.blackHoleSprite) {
		renderer.scene.add(particleSystem.blackHoleSprite);
	}

	simManager.onUpdate = (data) => {
		particleSystem.update(data, config.particleSize);
	};
}

createSimulation(config.particleCount);

const ui = new UIController(config);

config.injectBlackHole = () => {
	simManager.setParticleMass(0, config.blackHoleMass);
	const idx0 = 0 * STRIDE;
	simManager.particleData[idx0 + 3] = 0;
	simManager.particleData[idx0 + 4] = 0;
	simManager.particleData[idx0 + 5] = 0;
};

config.resetGalaxy = () => {
	createSimulation(config.particleCount);
	initialEnergy = 0;
};

let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = performance.now();
let lastEnergyCheck = performance.now();
let initialEnergy = 0;
let energyDrift = 0;

function computeTotalEnergy(data: Float32Array, G: number, softeningSq: number): number {
	const count = data.length / STRIDE;
	let kinetic = 0;
	let potential = 0;
	for (let i = 0; i < count; i++) {
		const i7 = i * STRIDE;
		const vx = data[i7 + 3];
		const vy = data[i7 + 4];
		const vz = data[i7 + 5];
		const m = data[i7 + 6];
		kinetic += 0.5 * m * (vx * vx + vy * vy + vz * vz);
	}
	for (let i = 0; i < count; i++) {
		const i7 = i * STRIDE;
		const px = data[i7];
		const py = data[i7 + 1];
		const pz = data[i7 + 2];
		const mi = data[i7 + 6];
		for (let j = i + 1; j < count; j++) {
			const j7 = j * STRIDE;
			const dx = data[j7] - px;
			const dy = data[j7 + 1] - py;
			const dz = data[j7 + 2] - pz;
			const distSq = dx * dx + dy * dy + dz * dz + softeningSq;
			const mj = data[j7 + 6];
			potential -= (G * mi * mj) / Math.sqrt(distSq);
		}
	}
	return kinetic + potential;
}

function animationLoop() {
	requestAnimationFrame(animationLoop);
	const now = performance.now();
	const deltaTime = Math.min(now - lastTime, 100);
	lastTime = now;
	frameCount++;
	if (now - fpsTimer >= 200) {
		const fps = Math.round((frameCount * 1000) / (now - fpsTimer));
		frameCount = 0;
		fpsTimer = now;
		const fpsEl = document.getElementById("fps-display");
		if (fpsEl) fpsEl.innerText = fps.toString();
		const frameTimeEl = document.getElementById("frame-time");
		if (frameTimeEl) frameTimeEl.innerText = deltaTime.toFixed(2);
	}
	if (now - lastEnergyCheck > 500) {
		lastEnergyCheck = now;
		const currentEnergy = computeTotalEnergy(
			simManager.particleData,
			config.gravitationalConstant,
			config.softeningEpsilon * config.softeningEpsilon,
		);
		if (initialEnergy === 0) initialEnergy = currentEnergy;
		energyDrift = Math.abs((currentEnergy - initialEnergy) / initialEnergy) * 100;
		const energyEl = document.getElementById("energy-drift");
		if (energyEl) energyEl.innerText = energyDrift.toFixed(4) + "%";
	}
	renderer.controls.autoRotate = !config.isPaused;
	if (!config.isPaused) {
		const effectiveDt = config.timeStep * config.timeScale;
		simManager.step({
			G: config.gravitationalConstant,
			DT: effectiveDt,
			SOFTENING: config.softeningEpsilon,
			STEPS: config.integrationSteps,
		});
	} else {
		if (simManager.onUpdate) {
			simManager.onUpdate(simManager.particleData);
		}
	}
	postFX.setBloomIntensity(config.bloomIntensity);
	renderer.controls.update();
	postFX.render();
}

animationLoop();

window.addEventListener("resize", () => {
	renderer.onWindowResize();
	postFX.setSize(window.innerWidth, window.innerHeight);
});

function renderFormula(tex: string, displayMode: boolean = true): string {
	try {
		return katex.renderToString(tex, { displayMode, throwOnError: false });
	} catch (e) {
		return `<span style="color:red">${tex}</span>`;
	}
}

const eq = {
	F_ij: String.raw`F_{ij} = G \cdot \frac{m_i \cdot m_j}{r_{ij}^2}`,
	F_net: String.raw`\vec{F}_{\text{net}, i} = \sum_{j \neq i} \vec{F}_{ij}`,
	leapfrog1: String.raw`\begin{aligned} \vec{v}(t + \frac{\Delta t}{2}) &= \vec{v}(t) + \vec{a}(t) \cdot \frac{\Delta t}{2} \\ \vec{x}(t + \Delta t) &= \vec{x}(t) + \vec{v}(t + \frac{\Delta t}{2}) \cdot \Delta t \end{aligned}`,
	leapfrog2: String.raw`\vec{v}(t + \Delta t) = \vec{v}(t + \frac{\Delta t}{2}) + \vec{a}(t + \Delta t) \cdot \frac{\Delta t}{2}`,
	force_soft: String.raw`F_{ij} = G \cdot \frac{m_i \cdot m_j}{(r_{ij}^2 + \varepsilon^2)^{3/2}} \cdot \vec{r}_{ij}`,
	energy: String.raw`E_{\text{total}} = \sum_i \frac{1}{2} m_i v_i^2 - \sum_{i < j} G \frac{m_i m_j}{\sqrt{r_{ij}^2 + \varepsilon^2}}`,
	F_simple: String.raw`F = G \frac{m_1 m_2}{r^2}`,
	v_half: String.raw`v_{\text{half}} = v + a \cdot \frac{\Delta t}{2}`,
	x_new: String.raw`x_{\text{new}} = x + v_{\text{half}} \cdot \Delta t`,
	F_basic: String.raw`F = G \frac{m_1 m_2}{r^2}`,
	accel: String.raw`a = \frac{F}{m}`,
	velocity_update: String.raw`v_{\text{new}} = v + a \cdot \Delta t`,
	position_update: String.raw`x_{\text{new}} = x + v \cdot \Delta t`,
};

const explanations = {
	advanced: `
    <p>A multi‑threaded particle simulation demonstrating core concepts from <strong>AP Physics C (Mechanics)</strong> and <strong>AP Calculus BC</strong>.</p>
    <h3>PHYSICS FOUNDATION</h3>
    <p><span class="highlight">Newton's Law of Universal Gravitation</span> in vector form: each pair of particles exerts an attractive force along the line connecting them.</p>
    <div class="equation">${renderFormula(eq.F_ij)}</div>
    <p>The <span class="highlight">superposition principle</span> states that the net force on a particle is the vector sum of all individual gravitational forces.</p>
    <div class="equation">${renderFormula(eq.F_net)}</div>
    <h3>NUMERICAL INTEGRATION (AP Calculus BC)</h3>
    <p>The equations of motion form a system of second‑order ordinary differential equations. We solve them using the <span class="highlight">Leapfrog (Störmer‑Verlet) method</span>, a second‑order symplectic integrator that approximately conserves energy over long timescales.</p>
    <div class="equation">${renderFormula(eq.leapfrog1)}</div>
    <p>After the position update, accelerations are recomputed and the velocity gets its second half‑kick:</p>
    <div class="equation">${renderFormula(eq.leapfrog2)}</div>
    <p>The time step <span class="highlight">Δt</span> directly affects the truncation error of the integration. Large Δt leads to rapid energy drift, visually demonstrating numerical instability.</p>
    <h3>CONTROL PARAMETERS</h3>
    <p><span class="highlight">G (Gravitational Constant):</span> Scales the strength of gravitational interaction.</p>
    <p><span class="highlight">Softening ε:</span> Introduced to avoid the singularity when $r_{ij} \\to 0$. The modified force law is:</p>
    <div class="equation">${renderFormula(eq.force_soft)}</div>
    <p><span class="highlight">Δt (Time Step):</span> The integration step size.</p>
    <p><span class="highlight">Sub‑steps per frame:</span> Divides each Δt into multiple smaller steps for higher accuracy.</p>
    <h3>BLACK HOLE INJECTION</h3>
    <p>Assigns the central particle a mass of <span class="highlight">Singular Mass</span> and zero velocity, mimicking a supermassive black hole. This dramatically alters the local gravitational field.</p>
    <h3>ENERGY DRIFT</h3>
    <p>Total mechanical energy is computed as:</p>
    <div class="equation">${renderFormula(eq.energy)}</div>
    <p>Monitoring its relative change over time validates the integrator's performance.</p>
  `,
	intermediate: `
    <p>A multi‑threaded particle simulation aligned with <strong>AP Physics 1</strong> (algebra‑based) and <strong>AP Calculus AB</strong>.</p>
    <h3>PHYSICS (AP Physics 1)</h3>
    <p><span class="highlight">Newton's Law of Universal Gravitation:</span> the gravitational force between two masses is directly proportional to the product of their masses and inversely proportional to the square of the distance between their centers.</p>
    <div class="equation">${renderFormula(eq.F_simple)}</div>
    <p>Each particle experiences a <span class="highlight">net force</span> that is the vector sum of all gravitational pulls from every other particle. Using Newton's second law, we find the acceleration:</p>
    <div class="equation">${renderFormula(eq.accel)}</div>
    <h3>CALCULUS (AP Calculus AB)</h3>
    <p>Because forces change continuously as particles move, we cannot write a simple formula for position as a function of time. Instead, we approximate the motion over a small time step Δt using <span class="highlight">numerical integration</span>. This is analogous to a Riemann sum: we break the motion into tiny intervals and assume acceleration is constant during each interval.</p>
    <p>The <span class="highlight">Leapfrog method</span> improves accuracy by evaluating velocity at the midpoint of each time step, which better conserves energy.</p>
    <div class="equation">${renderFormula(eq.v_half)}</div>
    <div class="equation">${renderFormula(eq.x_new)}</div>
    <p>A larger Δt makes the simulation run faster but increases the error — watch the <span class="highlight">Energy Drift</span> percentage to see the effect of approximation error.</p>
    <h3>CONTROLS</h3>
    <p><span class="highlight">G:</span> Gravitational constant — scales the strength of gravity.</p>
    <p><span class="highlight">ε (softening):</span> Prevents unrealistic accelerations when particles get extremely close.</p>
    <p><span class="highlight">Δt:</span> Time step for integration.</p>
    <p><span class="highlight">Inject Black Hole:</span> Sets the central particle's mass to a very large value, simulating a supermassive black hole.</p>
  `,
	middle: `
    <p>A computer model of a galaxy, built using <strong>Algebra I & II</strong> and basic physics concepts. No calculus required!</p>
    <h3>GRAVITY: THE INVERSE‑SQUARE LAW</h3>
    <p>The force of gravity between two objects depends on their masses and the distance between them. If you double the distance, the force becomes one‑fourth as strong — an <span class="highlight">inverse‑square relationship</span>.</p>
    <div class="equation">${renderFormula(eq.F_basic)}</div>
    <p>In this simulation, every star pulls on every other star. The computer adds up all these tiny tugs to find the <span class="highlight">net force</span> on each star.</p>
    <h3>FROM FORCE TO MOTION</h3>
    <p>Using $a = F/m$, we find the acceleration of each star. Then we update the velocity and position over a small time interval Δt (like 0.016 seconds):</p>
    <div class="equation">${renderFormula(eq.velocity_update)}</div>
    <div class="equation">${renderFormula(eq.position_update)}</div>
    <p>This process repeats hundreds of times per second — that's why it's called <span class="highlight">numerical integration</span>. It's like making a flipbook: each page shows a tiny change from the previous one.</p>
    <h3>WHY "SOFTENING"?</h3>
    <p>When two stars get extremely close, the $1/r^2$ term would blow up, making them shoot off at unrealistic speeds. We add a small number $\varepsilon$ to the distance to keep the math stable.</p>
    <h3>SLIDERS & BUTTONS</h3>
    <p><span class="highlight">G:</span> makes gravity stronger or weaker.</p>
    <p><span class="highlight">ε (softening):</span> controls how much we smooth out close encounters.</p>
    <p><span class="highlight">Δt:</span> time step size — larger steps run faster but may look jerky or inaccurate.</p>
    <p><span class="highlight">Inject Black Hole:</span> turns the center into a supermassive object that dramatically warps the orbits.</p>
  `,
	basic: `
    <p>This is a model of stars moving under the force of gravity. No advanced math needed!</p>
    <h3>WHAT IS GRAVITY?</h3>
    <p>Gravity is a pulling force between things that have mass. <span class="highlight">More mass = stronger pull. Closer together = stronger pull.</span></p>
    <div class="equation">${renderFormula(eq.F_basic, true)}</div>
    <h3>HOW DOES THE COMPUTER MOVE THE STARS?</h3>
    <p>The computer looks at where every star is, figures out how hard they're pulling on each other, and then nudges them just a tiny bit. It does this over and over, like a flipbook, to create smooth motion.</p>
    <h3>WHAT DO THE SLIDERS DO?</h3>
    <p><span class="highlight">G:</span> makes gravity stronger or weaker.</p>
    <p><span class="highlight">ε:</span> stops stars from shooting off crazily when they get too close.</p>
    <p><span class="highlight">Δt:</span> changes how big the nudges are. Bigger nudges = faster but less smooth.</p>
    <p><span class="highlight">Inject Black Hole:</span> puts a super heavy star in the middle.</p>
    <h3>COLORS</h3>
    <p>Blue stars are moving slowly. Red/orange stars are moving fast.</p>
  `,
	tech: `
    <h3>FRONTEND & RENDERING</h3>
    <p><span class="tech-badge">Three.js r184</span> <span class="tech-badge">postprocessing v6.39</span></p>
    <p>WebGL rendering with UnrealBloomPass for a neon glow effect. No custom GLSL — pure JavaScript/TypeScript.</p>
    <h3>UI & CONTROLS</h3>
    <p><span class="tech-badge">lil‑gui v0.21</span></p>
    <p>Floating control panel for real‑time parameter adjustment. Zero CSS required.</p>
    <h3>MATHEMATICAL NOTATION</h3>
    <p><span class="tech-badge">KaTeX v0.16.45</span></p>
    <p>Fast, server‑independent LaTeX rendering for equations in this info panel.</p>
    <h3>BUILD TOOLCHAIN</h3>
    <p><span class="tech-badge">Vite v8</span> <span class="tech-badge">TypeScript v6</span></p>
    <p>Instant HMR, native ES modules, and strict type checking for robust code.</p>
    <h3>CONCURRENCY & PERFORMANCE</h3>
    <p><span class="tech-badge">Web Workers</span> <span class="tech-badge">Float32Array</span> <span class="tech-badge">Transferables</span></p>
    <p>Multi‑threaded physics engine with zero‑copy memory transfer. The $O(N^2)$ force calculation is distributed across all available CPU cores, making it an excellent <span class="highlight">benchmark for parallel JavaScript performance</span>.</p>
    <h3>BENCHMARKING CAPABILITIES</h3>
    <p>This simulation can be used to measure:</p>
    <ul>
      <li><span class="highlight">Throughput:</span> Frames per second (FPS) at different particle counts.</li>
      <li><span class="highlight">Latency:</span> Frame time (ms) — time taken to compute one physics step plus rendering.</li>
      <li><span class="highlight">Scalability:</span> Speedup ratio when increasing the number of Web Workers.</li>
      <li><span class="highlight">Numerical Stability:</span> Energy drift percentage over time.</li>
    </ul>
    <p>Use the <span class="highlight">Particle Count</span> slider in the GUI to stress‑test your CPU with up to 20,000 particles!</p>
    <h3>PHYSICS CORE</h3>
    <p>Leapfrog (Störmer‑Verlet) integrator implemented in pure TypeScript. Flat array storage ensures cache‑efficient access.</p>
    <h3>DEPENDENCIES (package.json)</h3>
    <ul>
      <li><span class="highlight">three</span> ^0.184.0</li>
      <li><span class="highlight">postprocessing</span> ^6.39.1</li>
      <li><span class="highlight">lil‑gui</span> ^0.21.0</li>
      <li><span class="highlight">katex</span> ^0.16.45</li>
      <li><span class="highlight">typescript</span> ^6.0.3 (dev)</li>
      <li><span class="highlight">vite</span> ^8.0.8 (dev)</li>
    </ul>
  `,
};

const advancedEl = document.getElementById("explanation-advanced");
const intermediateEl = document.getElementById("explanation-intermediate");
const middleEl = document.getElementById("explanation-middle");
const basicEl = document.getElementById("explanation-basic");
const techEl = document.getElementById("explanation-tech");

if (advancedEl) advancedEl.innerHTML = explanations.advanced;
if (intermediateEl) intermediateEl.innerHTML = explanations.intermediate;
if (middleEl) middleEl.innerHTML = explanations.middle;
if (basicEl) basicEl.innerHTML = explanations.basic;
if (techEl) techEl.innerHTML = explanations.tech;

const tabs = document.querySelectorAll(".tab-btn");
const panes = document.querySelectorAll(".explanation-pane");

tabs.forEach((tab) => {
	tab.addEventListener("click", () => {
		const level = (tab as HTMLElement).dataset.level;
		if (!level) return;
		tabs.forEach((t) => t.classList.remove("active"));
		panes.forEach((p) => p.classList.remove("active"));
		tab.classList.add("active");
		const targetPane = document.getElementById(`explanation-${level}`);
		if (targetPane) targetPane.classList.add("active");
	});
});

const modal = document.getElementById("modal-overlay");
const btn = document.getElementById("info-button");
const close = document.getElementById("modal-close");

if (btn && modal) {
	btn.addEventListener("click", () => modal.classList.add("active"));
}
if (close && modal) {
	close.addEventListener("click", () => modal.classList.remove("active"));
}
if (modal) {
	modal.addEventListener("click", (e) => {
		if (e.target === modal) modal.classList.remove("active");
	});
}
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && modal) {
		modal.classList.remove("active");
	}
});
