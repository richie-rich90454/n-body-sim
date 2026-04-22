import { explanations } from "./explanations";

export function injectExplanations() {
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
}

export function setupModalAndTabs() {
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
	if (btn && modal) btn.addEventListener("click", () => modal.classList.add("active"));
	if (close && modal) close.addEventListener("click", () => modal.classList.remove("active"));
	if (modal) {
		modal.addEventListener("click", (e) => {
			if (e.target === modal) modal.classList.remove("active");
		});
	}
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && modal) modal.classList.remove("active");
	});
}

export function updateFPSDisplay(fps: string, frameTime: string) {
	const fpsEl = document.getElementById("fps-display");
	const frameTimeEl = document.getElementById("frame-time");
	if (fpsEl) fpsEl.innerText = fps;
	if (frameTimeEl) frameTimeEl.innerText = frameTime;
}

export function updateEnergyDisplay(energyDrift: number) {
	const energyEl = document.getElementById("energy-drift");
	if (energyEl) energyEl.innerText = energyDrift.toFixed(4) + "%";
}
