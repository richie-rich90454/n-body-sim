import katex from "katex";
import "katex/dist/katex.min.css";

export function renderFormula(tex: string, displayMode: boolean = true): string {
    try {
        return katex.renderToString(tex, { displayMode, throwOnError: false });
    } catch (e) {
        return `<span style="color:red">${tex}</span>`;
    }
}

export function renderInline(tex: string): string {
    return renderFormula(tex, false);
}

export const eq = {
    F_ij: String.raw`F_{ij} = G \cdot \frac{m_i \cdot m_j}{r_{ij}^2}`,
    F_net: String.raw`\vec{F}_{\text{net}, i} = \sum_{j \neq i} \vec{F}_{ij}`,
    leapfrog1: String.raw`\begin{aligned} \vec{v}(t + \frac{\Delta t}{2}) &= \vec{v}(t) + \vec{a}(t) \cdot \frac{\Delta t}{2} \\ \vec{x}(t + \Delta t) &= \vec{x}(t) + \vec{v}(t + \frac{\Delta t}{2}) \cdot \Delta t \end{aligned}`,
    leapfrog2: String.raw`\vec{v}(t + \Delta t) = \vec{v}(t + \frac{\Delta t}{2}) + \vec{a}(t + \Delta t) \cdot \frac{\Delta t}{2}`,
    force_soft: String.raw`\vec{F}_{ij} = G \cdot \frac{m_i \cdot m_j}{(r_{ij}^2 + \varepsilon^2)^{3/2}} \cdot \vec{r}_{ij}`,
    energy: String.raw`E_{\text{total}} = \sum_i \frac{1}{2} m_i v_i^2 - \sum_{i < j} G \frac{m_i m_j}{\sqrt{r_{ij}^2 + \varepsilon^2}}`,
    F_simple: String.raw`F = G \frac{m_1 m_2}{r^2}`,
    v_half: String.raw`v_{\text{half}} = v + a \cdot \frac{\Delta t}{2}`,
    x_new: String.raw`x_{\text{new}} = x + v_{\text{half}} \cdot \Delta t`,
    F_basic: String.raw`F = G \frac{m_1 m_2}{r^2}`,
    accel: String.raw`a = \frac{F}{m}`,
    velocity_update: String.raw`v_{\text{new}} = v + a \cdot \Delta t`,
    position_update: String.raw`x_{\text{new}} = x + v \cdot \Delta t`,
    accel_vec: String.raw`\vec{a}_i = \frac{\vec{F}_{\text{net}, i}}{m_i}`,
    sigma_f: String.raw`\Sigma F = m a`,
};

export const explanations = {
    advanced: `
    <p>A high‑performance N‑body galaxy simulation built for <strong>AP Physics C: Mechanics</strong> and <strong>AP Calculus BC</strong>. It combines a symplectic integrator, rigorous vector calculus, and modern GPU acceleration to deliver physically accurate orbits and real‑time interactivity.</p>
    <h3>PHYSICS FOUNDATION</h3>
    <p><span class="highlight">Newton's Law of Universal Gravitation</span> in vector form: every pair of particles attracts each other along the line joining them. The magnitude is proportional to the product of their masses and inversely proportional to the square of their separation.</p>
    <div class="equation">${renderFormula(eq.F_ij)}</div>
    <p>By the <span class="highlight">superposition principle</span>, the net force on a particle is the vector sum of all individual gravitational forces. For N particles this requires ${renderInline("O(N^2)")} pairwise interactions per time step.</p>
    <div class="equation">${renderFormula(eq.F_net)}</div>
    <p>Acceleration follows from Newton's second law: ${renderFormula(eq.accel_vec)}. The resulting equations of motion are a coupled system of second‑order ordinary differential equations.</p>
    <h3>NUMERICAL INTEGRATION (AP Calculus BC)</h3>
    <p>Only the two‑body problem has an analytical solution; for N > 2 we must approximate numerically. The simulation uses the <span class="highlight">Leapfrog (Störmer‑Verlet) integrator</span>, a second‑order symplectic method. Symplectic integrators preserve the geometric structure of Hamiltonian systems, giving excellent long‑term energy conservation compared to simple Euler methods.</p>
    <p>The algorithm splits each time step ${renderInline("\\Delta t")} into a "kick‑drift‑kick" sequence:</p>
    <div class="equation">${renderFormula(eq.leapfrog1)}</div>
    <p>After positions are updated, accelerations are recomputed from the new configuration, and the second half‑kick completes the velocity:</p>
    <div class="equation">${renderFormula(eq.leapfrog2)}</div>
    <p>The <span class="highlight">Sub‑steps per frame</span> slider divides each Δt into multiple smaller increments, reducing truncation error without slowing visual playback. A larger Δt increases the local error, visible as a rise in the <span class="highlight">Energy Drift</span> percentage.</p>
    <h3>SOFTENING & REGULARIZATION</h3>
    <p>When particles nearly collide, the ${renderInline("1/r^2")} singularity causes arbitrarily large forces. We introduce a <span class="highlight">softening length ε</span> that smooths the force at small separations:</p>
    <div class="equation">${renderFormula(eq.force_soft)}</div>
    <p>This keeps the integration stable without affecting large‑scale dynamics.</p>
    <h3>GALACTIC NUCLEUS & BLACK HOLE INJECTION</h3>
    <p>A central <strong>nucleus particle</strong> of mass 20,000 sits at the origin and is held fixed (immovable under disc forces) to prevent drift. This represents the dense star cluster or seed black hole found in real galaxies. The visual black hole sprite only appears when a particle’s mass exceeds 50,000 – the nucleus alone is below this threshold, so no sprite is shown initially.</p>
    <p>Clicking <span class="highlight">"Inject Black Hole"</span> turns the farthest particle into a supermassive black hole with mass <span class="highlight">Singular Mass</span> (default 150,000). Its velocity is zeroed, and the nucleus is unfrozen so both objects feel each other's gravity. This creates a dramatic merger event, often ejecting nearby stars via the gravitational slingshot effect.</p>
    <h3>ENERGY & STABILITY MONITORING</h3>
    <p>Total mechanical energy is computed on‑the‑fly:</p>
    <div class="equation">${renderFormula(eq.energy)}</div>
    <p>The percentage change since the last reset is displayed as <span class="highlight">Energy Drift</span>. A well‑tuned leapfrog run with ε=10 and 2 substeps typically drifts less than 0.01% per thousand steps.</p>
    <h3>PARALLEL & GPU ACCELERATION</h3>
    <p>The ${renderInline("O(N^2)")} force calculation is the bottleneck. On <strong>WebGPU‑capable browsers</strong> (Chrome, Edge, Safari) the calculation is offloaded to the GPU via a custom WGSL compute shader that processes thousands of work‑items simultaneously. On unsupported browsers, the simulation falls back to a multi‑threaded CPU implementation using <span class="highlight">Web Workers</span> and <span class="highlight">SharedArrayBuffer</span>. Both paths produce identical, exact results – the GPU simply delivers a dramatic speed‑up, allowing smooth playback at higher particle counts (up to 20,000+).</p>
  `,
    intermediate: `
    <p>A multi‑threaded particle simulation designed for <strong>AP Physics 1</strong> and <strong>AP Calculus AB</strong>. The core concepts are presented without vector calculus notation, though the underlying engine uses full 3D vectors.</p>
    <h3>PHYSICS (AP Physics 1)</h3>
    <p><span class="highlight">Newton's Law of Universal Gravitation</span>: The attractive force between two point masses is proportional to the product of their masses and inversely proportional to the square of the distance between them.</p>
    <div class="equation">${renderFormula(eq.F_simple)}</div>
    <p>Each particle feels a <span class="highlight">net force</span> that is the vector sum of all pulls from every other particle. Newton's second law, ${renderFormula(eq.sigma_f)}, gives the acceleration:</p>
    <div class="equation">${renderFormula(eq.accel)}</div>
    <p>Because the forces change continuously as positions change, we cannot solve for position vs. time with a simple formula.</p>
    <h3>CALCULUS (AP Calculus AB)</h3>
    <p>Acceleration is the derivative of velocity, and velocity is the derivative of position. To find the motion, we use <span class="highlight">numerical integration</span>: break time into tiny intervals ${renderInline("\\Delta t")} and assume the acceleration is nearly constant during each interval. This is like a Riemann sum – we add up many small changes to approximate the true motion.</p>
    <p>The <span class="highlight">Leapfrog method</span> improves accuracy by evaluating velocity at the midpoint of each step, giving much better energy conservation than the basic Euler method.</p>
    <div class="equation">${renderFormula(eq.v_half)}</div>
    <div class="equation">${renderFormula(eq.x_new)}</div>
    <p>A larger ${renderInline("\\Delta t")} makes the simulation run faster but increases the error, visible as a rise in the <span class="highlight">Energy Drift</span> number.</p>
    <h3>GALACTIC CENTER & BLACK HOLE</h3>
    <p>The simulation begins with a central heavy particle (mass 20,000) representing a galactic nucleus. This central object is kept fixed to stabilise the galaxy; a visual black hole ring appears only when a particle's mass exceeds 50,000. Pressing <span class="highlight">"Inject Black Hole"</span> turns the farthest particle into a supermassive black hole (default 150,000), unfreezes the central mass, and allows the two to interact gravitationally. This often flings nearby stars outward at high speed.</p>
    <h3>CONTROLS</h3>
    <p><span class="highlight">G:</span> Scales the strength of gravity.</p>
    <p><span class="highlight">ε (softening):</span> Prevents unrealistically large accelerations during close encounters.</p>
    <p><span class="highlight">Δt:</span> Time step; decreasing it improves accuracy.</p>
    <p><span class="highlight">Sub‑steps per frame:</span> Divides Δt into smaller increments for better accuracy without slowing visual playback.</p>
    <p><span class="highlight">Inject Black Hole:</span> Transforms the farthest particle into a supermassive black hole.</p>
  `,
    middle: `
    <p>A computer model of a galaxy, explained with <strong>Algebra I & II</strong> and introductory physical science. No calculus needed!</p>
    <h3>GRAVITY: THE INVERSE‑SQUARE LAW</h3>
    <p>The gravitational force between two objects depends on their masses and the distance. If you double the distance, the force falls to one‑quarter. That is an <span class="highlight">inverse‑square relationship</span>.</p>
    <div class="equation">${renderFormula(eq.F_basic)}</div>
    <p>In the simulation, every star pulls on every other star. The computer adds up all these individual pulls to find the <span class="highlight">net force</span> on each star, which then determines how it accelerates.</p>
    <h3>FROM FORCE TO MOTION</h3>
    <p>From ${renderInline("F = ma")} we get acceleration. Then we update velocity and position over a tiny time step ${renderInline("\\Delta t")} (about 0.016 seconds):</p>
    <div class="equation">${renderFormula(eq.velocity_update)}</div>
    <div class="equation">${renderFormula(eq.position_update)}</div>
    <p>This repeats hundreds of times per second – like a flipbook – to create smooth motion. Adding up these tiny changes is called <span class="highlight">numerical integration</span>.</p>
    <h3>WHY SOFTENING?</h3>
    <p>When stars get extremely close, the force would become enormous. We add a small number ε (epsilon) to the distance to keep everything stable and realistic.</p>
    <h3>GALAXY CENTER</h3>
    <p>A very heavy star sits at the centre (about 8,000 times heavier than a normal star). It stays fixed to keep the galaxy steady. A black hole picture appears only when a star is heavier than 50,000. Pressing <span class="highlight">"Inject Black Hole"</span> turns the farthest star into an even heavier black hole, which can fling other stars away.</p>
    <h3>SLIDERS & BUTTONS</h3>
    <p><span class="highlight">G:</span> Strength of gravity.</p>
    <p><span class="highlight">ε (softening):</span> Smooths out close encounters.</p>
    <p><span class="highlight">Δt:</span> Size of each time nudge; smaller gives smoother motion.</p>
    <p><span class="highlight">Inject Black Hole:</span> Creates a super‑heavy object that warps nearby orbits.</p>
  `,
    basic: `
    <p>Watch stars orbit under gravity! No math required – just play and explore.</p>
    <h3>WHAT IS GRAVITY?</h3>
    <p>Gravity pulls things together. <span class="highlight">More mass = stronger pull. Closer together = stronger pull.</span></p>
    <div class="equation">${renderFormula(eq.F_basic, true)}</div>
    <p>The equation shows that force depends on both masses and distance.</p>
    <h3>HOW DOES THE SIMULATION MOVE STARS?</h3>
    <p>The computer looks at all stars, calculates how hard they pull on each other, and nudges each star by a tiny amount. It does this over and over, like a flipbook, to create smooth motion.</p>
    <h3>THE HEAVY STAR IN THE MIDDLE</h3>
    <p>A very heavy star sits at the centre, like in a real galaxy. A black hole picture appears only when a star gets extremely heavy (above 50,000). Pressing <span class="highlight">"Inject Black Hole"</span> makes the farthest star super‑heavy, which can throw other stars outward.</p>
    <h3>SLIDERS & BUTTONS</h3>
    <p><span class="highlight">G:</span> Strength of gravity.</p>
    <p><span class="highlight">ε (epsilon):</span> Prevents stars from shooting away when too close.</p>
    <p><span class="highlight">Δt (delta t):</span> Size of the nudges; larger = faster but jerkier.</p>
    <p><span class="highlight">Inject Black Hole:</span> Creates a super‑heavy star in the outer galaxy.</p>
    <h3>COLORS</h3>
    <p>Stars glow with warm yellow‑white colours when moving slowly, and become bright blue‑white when moving very fast. The colours come from a map inspired by thermal (black‑body) radiation – hotter = bluer, cooler = more yellow.</p>
  `,
    tech: `
    <h3>RENDERING & VISUALS</h3>
    <p><span class="tech-badge">Three.js r184</span> <span class="tech-badge">postprocessing v6.39</span></p>
    <p>The galaxy is rendered with <strong>Points</strong> using custom GLSL shaders. Each star is a tiny sprite texture with diffraction spikes. The colour of each star is driven by its <strong>kinetic energy</strong> (${renderInline("v^2")}), mapped through a <span class="highlight">chroma‑js</span> yellow‑white‑blue scale, giving a physically motivated glow: slow stars appear warm, fast stars become blue‑white.</p>
    <p>Multiple overlay layers – a warm bulge, cool dust lanes, and a faint halo – create realistic depth. An <strong>UnrealBloomPass</strong> adds the neon glow, with intensity automatically reduced when the camera is far away to prevent oversaturation.</p>
    <p>The black hole is a procedurally generated sprite resembling an asymmetric accretion disk (inspired by the M87* image). It rotates and flickers over time using its own ShaderMaterial with a time uniform.</p>
    <p>A simple <strong>gravitational lensing post‑processing pass</strong> distorts the background near the black hole, simulating the bending of light.</p>

    <h3>UI & CONTROLS</h3>
    <p><span class="tech-badge">lil‑gui v0.21</span></p>
    <p>All controls (G, ε, Δt, substeps, particle count, bloom, point size, auto‑rotate, etc.) are generated by lil‑gui. No custom CSS is needed for the interface.</p>

    <h3>MATHEMATICAL NOTATION</h3>
    <p><span class="tech-badge">KaTeX v0.16.45</span></p>
    <p>Equations are rendered at runtime using KaTeX, a fast LaTeX renderer that requires no external web fonts.</p>

    <h3>BUILD TOOLCHAIN</h3>
    <p><span class="tech-badge">Vite v8</span> <span class="tech-badge">TypeScript v6</span></p>
    <p>Vite provides instant hot module replacement during development and optimized production builds. TypeScript enforces strict type safety.</p>

    <h3>GPU ACCELERATION (WebGPU)</h3>
    <p><span class="tech-badge">WebGPU</span> <span class="tech-badge">WGSL</span> <span class="tech-badge">Compute Shaders</span></p>
    <p>On supported browsers (Chrome, Edge, Safari), the ${renderInline("O(N^2)")} direct force calculation runs entirely on the GPU via a <strong>WebGPU compute pipeline</strong>. The WGSL shader processes thousands of threads in parallel, each computing forces for one particle. Particle data is stored in GPU storage buffers (with a uniform for G and softening), and the resulting accelerations are read back via a staging buffer. A double‑buffered scheme avoids pipeline stalls and map‑async overlap. The leapfrog integration steps remain on the CPU for simplicity and precision.</p>

    <h3>CPU FALLBACK (Multi‑Threaded)</h3>
    <p><span class="tech-badge">Web Workers</span> <span class="tech-badge">SharedArrayBuffer</span> <span class="tech-badge">Atomics</span></p>
    <p>If WebGPU is unavailable (e.g., Firefox without the flag), the simulation automatically falls back to the optimized multi‑threaded CPU engine. Particle data lives in a single <strong>SharedArrayBuffer</strong> shared with multiple Web Workers. Each worker computes forces for a contiguous chunk of particles. The same two‑phase leapfrog synchronization guarantees the integrator's symplectic property is preserved. Colour computations use pre‑computed lookup tables (LUTs) generated by <span class="tech-badge">chroma‑js</span> to avoid per‑frame chroma calls.</p>

    <h3>BENCHMARKING CAPABILITIES</h3>
    <p>The simulation tracks:</p>
    <ul>
      <li><span class="highlight">FPS</span> and frame time (ms)</li>
      <li><span class="highlight">Energy Drift</span> – relative change in total energy since last reset, in percent</li>
    </ul>
    <p>Particle count can be increased up to 20,000 to stress‑test the GPU/CPU and observe the performance scaling.</p>

    <h3>DEPENDENCIES</h3>
    <ul>
      <li><span class="highlight">three</span> ^0.184.0</li>
      <li><span class="highlight">postprocessing</span> ^6.39.1</li>
      <li><span class="highlight">lil‑gui</span> ^0.21.0</li>
      <li><span class="highlight">katex</span> ^0.16.45</li>
      <li><span class="highlight">chroma‑js</span> ^3.2.0</li>
      <li><span class="highlight">typescript</span> ^6.0.3 (dev)</li>
      <li><span class="highlight">vite</span> ^8.0.8 (dev)</li>
      <li><span class="highlight">prettier</span> ^3.8.3 (dev)</li>
      <li><span class="highlight">@types/three</span> ^0.184.0 (dev)</li>
      <li><span class="highlight">@types/chroma‑js</span> ^3.1.2 (dev)</li>
      <li><span class="highlight">@types/katex</span> ^0.16.8 (dev)</li>
      <li><span class="highlight">@webgpu/types</span> ^0.1.69 (dev)</li>
    </ul>
  `,
};
