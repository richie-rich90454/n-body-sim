import GUI from 'lil-gui'

export interface SimConfig {
    gravitationalConstant: number
    softeningEpsilon: number
    blackHoleMass: number
    timeStep: number
    integrationSteps: number
    bloomIntensity: number
    particleSize: number
    timeScale: number
    isPaused: boolean
    particleCount: number
    injectBlackHole: () => void
    resetGalaxy: () => void
}

export class UIController {
    private gui: GUI
    public config: SimConfig

    constructor(config: SimConfig) {
        this.config = config
        this.gui = new GUI({ title: 'N-Body Dynamics Engine' })
        this.gui.domElement.style.marginTop = '10px'
        this.setupPhysicsFolder()
        this.setupCalculusFolder()
        this.setupVisualsFolder()
        this.setupSimulationFolder()
    }

    private setupPhysicsFolder() {
        const phys = this.gui.addFolder('AP Physics C: Mechanics')
        phys.add(this.config, 'gravitationalConstant', 0.1, 2.0, 0.01).name('G Constant').listen()
        phys.add(this.config, 'softeningEpsilon', 1.0, 50.0, 0.5).name('Softening (e)').listen()
        phys.add(this.config, 'blackHoleMass', 5000, 500000, 1000).name('Singular Mass')
        phys.add(this.config, 'injectBlackHole').name('Inject Black Hole')
        phys.add(this.config, 'resetGalaxy').name('Reset Galaxy')
        phys.open()
    }

    private setupCalculusFolder() {
        const calc = this.gui.addFolder('AP Calculus BC: Integration')
        calc.add(this.config, 'timeStep', 0.005, 0.05, 0.001).name('Dt (Time Step)').listen()
        calc.add(this.config, 'integrationSteps', 1, 5, 1).name('Sub-steps per frame').listen()
    }

    private setupVisualsFolder() {
        const vis = this.gui.addFolder('Rendering')
        vis.add(this.config, 'timeScale', 0.1, 3.0, 0.1).name('Time Scale')
        vis.add(this.config, 'particleSize', 0.5, 8.0, 0.1).name('Point Size')
        vis.add(this.config, 'bloomIntensity', 0.0, 3.0, 0.1).name('Bloom Intensity')
        vis.add(this.config, 'isPaused').name('Pause Simulation')
    }

    private setupSimulationFolder() {
        const sim = this.gui.addFolder('Simulation')
        sim.add(this.config, 'particleCount', 1000, 20000, 500)
            .name('Particle Count')
            .onChange(() => this.config.resetGalaxy())
    }
}