# N-Body Gravitational Dynamics

A high-performance N-body particle simulation implemented in TypeScript, employing WebGPU compute shaders for primary acceleration with a multi-threaded CPU fallback using Web Workers and SharedArrayBuffer. The code serves as an educational resource for advanced placement physics and calculus, a hardware benchmark, and a demonstration of modern browser capabilities for general-purpose GPU computing.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Physics and Numerical Methods](#physics-and-numerical-methods)
- [Control Parameters](#control-parameters)
- [Performance Benchmarking](#performance-benchmarking)
- [Project Structure](#project-structure)
- [License](#license)

## Features

- Exact O(N²) direct gravitational force summation; no tree-code approximations are applied.
- Primary acceleration via WebGPU compute shaders (supported in Chrome, Edge, Safari) with a fallback to parallel CPU execution using Web Workers.
- Particle data stored in a single SharedArrayBuffer – no per-frame copying occurs in either path.
- Symplectic second-order leapfrog (Störmer-Verlet) integration, synchronized across workers to preserve the integrator’s geometric properties.
- Real-time three-dimensional visualization with Three.js, custom GLSL point sprites with diffraction spikes, and UnrealBloomPass post-processing.
- Animated black hole sprite procedurally generated to resemble an asymmetric accretion disk.
- Gravitational lensing post-processing effect tuned by the black hole’s screen-space position.
- Rotation curve overlay showing tangential velocity versus galactocentric radius.
- Particle coloring based on kinetic energy (v²), mapped through a yellow-white-blue scale inspired by blackbody radiation.
- Fully interactive lil‑gui control panel with tooltips for all parameters rendered with KaTeX.
- Built-in performance telemetry: frames per second, frame time, and relative energy drift.

## Technology Stack

| Category              | Technology                                              |
| --------------------- | ------------------------------------------------------- |
| Language              | TypeScript 6.0                                          |
| Build Tool            | Vite 8                                                  |
| GPU Acceleration      | WebGPU (WGSL compute shaders)                           |
| CPU Parallelism       | Web Workers, SharedArrayBuffer, Atomics (fallback path) |
| 3D Rendering          | Three.js r184                                           |
| Post-Processing       | postprocessing (UnrealBloomPass, ShaderPass)            |
| Color Interpolation   | chroma-js 3.2                                           |
| UI Controls           | lil-gui 0.21                                            |
| Mathematical Notation | KaTeX 0.16.45                                           |
| Code Formatting       | Prettier 3.8                                            |

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/richie-rich90454/n-body-sim.git
cd n-body-sim
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Usage

Upon loading, the simulation displays a spiral galaxy of 6,000 particles around a fixed central nucleus. The camera supports:

- **Rotate** – left-click and drag.
- **Zoom** – scroll wheel or pinch.
- **Pan** – right-click and drag.

The control panel (lil‑gui) on the right provides real-time adjustment of physics, integration, rendering, and camera parameters. The information button (top-left) opens a modal window with tabbed educational content.

### Key Interactions

- **Inject Black Hole** – selects the farthest particle, sets its mass to the configured single mass, zeroes its velocity, and unpins the central nucleus so both objects interact gravitationally.
- **Reset Galaxy** – regenerates the initial particle distribution at the current particle count.
- **Particle Count Slider** – changes the number of bodies and automatically resets the simulation.

## Physics and Numerical Methods

### Gravitational Force

Newton’s law of universal gravitation with a softening length ε is applied in vector form:

```
F_ij = G * (m_i * m_j) / (r_ij² + ε²)^(3/2) * r_ij
```

The net force on particle i is the vector sum of forces from all other particles (superposition principle). The central nucleus (index 0) is immobilized during normal evolution to prevent drift; it moves only when a black hole is injected.

### Integration Scheme

The equations of motion are integrated using the leapfrog (kick-drift-kick) algorithm. For each substep of duration δt = Δt / N_sub:

1. **Half-kick**: v(t + δt/2) = v(t) + a(t) · δt/2
2. **Drift**: x(t + δt) = x(t) + v(t + δt/2) · δt
3. **Force re-evaluation** from the new positions.
4. **Half-kick**: v(t + δt) = v(t + δt/2) + a(t + δt) · δt/2

This second-order symplectic method conserves the Hamiltonian structure far better than simple Euler methods, leading to low energy drift over thousands of orbits.

### Parallel Execution

**WebGPU path:**  
A WGSL compute shader is dispatched with one thread per particle. Each thread reads the entire particle array from a GPU storage buffer and writes the resulting acceleration to an output buffer. The shader uses a uniform buffer for G and softening. Acceleration data is copied to a staging buffer and read back asynchronously. A double-buffered staging scheme prevents overlapping `mapAsync` calls and avoids pipeline stalls. The leapfrog updates remain on the CPU.

**CPU fallback path:**  
A single SharedArrayBuffer holds all particle data. One Web Worker per logical core is spawned. Workers receive their assigned index range and read the shared buffer directly; they return computed acceleration slices via transferable objects. The two force evaluations required by the leapfrog scheme are globally synchronized: the main thread waits for all workers to finish the old-position accelerations before applying the first half-kick and drift, then dispatches workers again for the new-position accelerations.

Both paths produce bitwise-identical results; the GPU path simply completes the O(N²) force sum much faster, enabling smooth playback at particle counts exceeding 20,000.

## Control Parameters

| Parameter | Range | Default | Description |
| --- | --- | --- | --- |
| G Constant | 1.0 – 4.0 | 2.0 | Scales the strength of gravitational interaction. |
| Softening (ε) | 1.0 – 50.0 | 10.0 | Smoothing length added to distance to avoid singularities. |
| Singular Mass | 5,000 – 500,000 | 150,000 | Mass assigned to the particle when a black hole is injected. |
| Time Step (Δt) | 0.005 – 0.05 | 0.016 | Base integration step size; smaller values improve accuracy. |
| Sub-steps per frame | 1 – 5 | 2 | Number of integration substeps performed per rendered frame. |
| Time Scale | 0.1 – 3.0 | 1.0 | Multiplier for simulation speed (does not affect accuracy). |
| Point Size | 2.0 – 6.0 | 4.0 | Rendered size of each star, scaled by depth. |
| Bloom Intensity | 0.0 – 3.0 | 1.5 | Strength of the UnrealBloomPass post-effect; auto-dimmed at far camera distances. |
| Auto Rotate | Boolean | true | Toggles automatic camera rotation around the galaxy center. |
| Particle Count | 1,000 – 20,000 | 6,000 | Number of bodies; changing this value resets the simulation. |
| Pause Simulation | Boolean | false | Freezes physics updates while allowing camera manipulation. |

## Performance Benchmarking

The simulation continuously displays:

- **FPS** and **Frame Time (ms)** – rendering throughput; a drop indicates saturation of the primary compute resource (GPU or CPU).
- **Energy Drift (%)** – relative change in total mechanical energy since the last reset; a metric of integrator stability. Values below 0.01% per thousand steps are typical for well-tuned parameters.

By modifying the particle count and observing the frame rate, users can assess:

- GPU compute throughput versus CPU multi-threaded scaling.
- Memory bandwidth limitations (SharedArrayBuffer access patterns).
- Garbage collection pressure (minimal in the current design due to pre-allocated LUTs and buffer reuse).

## Project Structure

```
src/
├── math/
│   └── PhysicsEngine.ts            # Galaxy initialization, STRIDE constant
├── simulation/
│   ├── SimulationManager.ts        # CPU worker pool manager, state synchronization
│   ├── physics.worker.ts           # Worker force computation (direct O(N²))
│   ├── WebGPUForce.ts              # WebGPU device setup, compute pipeline, readback
│   └── leapfrog.ts                 # Shared leapfrog update functions
├── visuals/
│   ├── SceneRenderer.ts            # Three.js scene, camera, lights, OrbitControls
│   ├── ParticleSystem.ts           # Multi-layer point rendering, star sprites, color LUTs
│   ├── PostFX.ts                   # Bloom and lensing post-processing
│   ├── UIController.ts             # lil-gui panel with tooltips
│   └── RotCurve.ts                 # Rotation curve graph overlay
├── script.ts                       # Entry point: bootstrap, modal, resize
├── style.css                       # Minimal overlay styles
├── ui.ts                           # FPS/energy update helpers, modal logic
├── explanations.ts                 # Educational content rendered with KaTeX
├── simulation.ts                   # Core state, energy calculation, GPU/CPU orchestration
└── vite-env.d.ts                   # Vite type declarations
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
