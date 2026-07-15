import GUI from "lil-gui";

export interface SimConfig {
    gravitationalConstant: number;
    softeningEpsilon: number;
    blackHoleMass: number;
    timeStep: number;
    integrationSteps: number;
    integrator: "leapfrog" | "yoshida4";
    bloomIntensity: number;
    particleSize: number;
    timeScale: number;
    isPaused: boolean;
    autoRotate: boolean;
    particleCount: number;
    seed: number;
    injectBlackHole: () => void;
    resetGalaxy: () => void;
}

export class UIController {
    private gui: GUI;
    public config: SimConfig;

    constructor(config: SimConfig) {
        this.config = config;
        this.gui = new GUI({ title: "N-Body Dynamics Engine" });
        this.gui.domElement.style.marginTop = "10px";
        this.setupPhysicsFolder();
        this.setupCalculusFolder();
        this.setupVisualsFolder();
        this.setupCameraFolder();
        this.setupSimulationFolder();
    }

    private addTooltip(controller: any, text: string): void {
        controller.domElement.title = text;
    }

    private setupPhysicsFolder() {
        const phys = this.gui.addFolder("AP Physics C: Mechanics");
        const gCtrl = phys
            .add(this.config, "gravitationalConstant", 1.0, 4.0, 0.01)
            .name("G Constant");
        gCtrl.listen();
        this.addTooltip(gCtrl, "Scales the overall strength of gravity (default 2.0)");
        const epsCtrl = phys
            .add(this.config, "softeningEpsilon", 1.0, 50.0, 0.5)
            .name("Softening (e)");
        epsCtrl.listen();
        this.addTooltip(
            epsCtrl,
            "Smooths forces at very small distances to prevent extreme accelerations (default 10.0)",
        );
        const massCtrl = phys
            .add(this.config, "blackHoleMass", 5000, 500000, 1000)
            .name("Singular Mass");
        this.addTooltip(massCtrl, "Mass to assign to the injected black hole (default 150000)");
        const injectCtrl = phys.add(this.config, "injectBlackHole").name("Inject Black Hole");
        this.addTooltip(injectCtrl, "Turn the farthest particle into a supermassive black hole");
        const resetCtrl = phys.add(this.config, "resetGalaxy").name("Reset Galaxy");
        this.addTooltip(resetCtrl, "Restart the simulation with the current particle count");
        phys.open();
    }

    private setupCalculusFolder() {
        const calc = this.gui.addFolder("AP Calculus BC: Integration");
        const dtCtrl = calc.add(this.config, "timeStep", 0.005, 0.05, 0.001).name("Dt (Time Step)");
        dtCtrl.listen();
        this.addTooltip(
            dtCtrl,
            "Integration time step; smaller values give more accurate orbits (default 0.016)",
        );
        const subCtrl = calc
            .add(this.config, "integrationSteps", 1, 5, 1)
            .name("Sub-steps per frame");
        subCtrl.listen();
        this.addTooltip(
            subCtrl,
            "Divides each frame's time step into smaller integration increments (default 2)",
        );
        const intCtrl = calc
            .add(this.config, "integrator", ["leapfrog", "yoshida4"])
            .name("Integrator");
        this.addTooltip(
            intCtrl,
            "Symplectic integrator: leapfrog is 2nd-order (faster), yoshida4 is 4th-order (more accurate, default leapfrog)",
        );
    }

    private setupVisualsFolder() {
        const vis = this.gui.addFolder("Rendering");
        const tsCtrl = vis.add(this.config, "timeScale", 0.1, 3.0, 0.1).name("Time Scale");
        this.addTooltip(
            tsCtrl,
            "Multiplier for simulation speed relative to real-time (default 1.0)",
        );
        const psCtrl = vis.add(this.config, "particleSize", 2.0, 6.0, 0.1).name("Point Size");
        this.addTooltip(
            psCtrl,
            "Base size of star points, scaled with camera distance (default 4.0)",
        );
        const bloomCtrl = vis
            .add(this.config, "bloomIntensity", 0.0, 3.0, 0.1)
            .name("Bloom Intensity");
        this.addTooltip(
            bloomCtrl,
            "Strength of the neon glow effect; automatically reduced when zoomed out (default 1.5)",
        );
        const pauseCtrl = vis.add(this.config, "isPaused").name("Pause Simulation");
        this.addTooltip(pauseCtrl, "Pause or resume the physics and rendering");
    }

    private setupCameraFolder() {
        const cam = this.gui.addFolder("Camera");
        const arCtrl = cam.add(this.config, "autoRotate").name("Auto Rotate");
        this.addTooltip(arCtrl, "Automatically rotate the camera around the galaxy");
        cam.open();
    }

    private setupSimulationFolder() {
        const sim = this.gui.addFolder("Simulation");
        const countCtrl = sim
            .add(this.config, "particleCount", 1000, 20000, 500)
            .name("Particle Count")
            .onChange(() => this.config.resetGalaxy());
        this.addTooltip(
            countCtrl,
            "Number of star particles; changing this resets the simulation (default 6000)",
        );
        const seedCtrl = sim
            .add(this.config, "seed", 1, 99999, 1)
            .name("Random Seed")
            .onChange(() => this.config.resetGalaxy());
        this.addTooltip(
            seedCtrl,
            "Seed for the deterministic galaxy initialisation; changing this resets the simulation (default 12345)",
        );
    }
}
