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
	force_soft: String.raw`F_{ij} = G \cdot \frac{m_i \cdot m_j}{(r_{ij}^2 + \varepsilon^2)^{3/2}} \cdot \vec{r}_{ij}`,
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
    <p>A multi‑threaded particle simulation demonstrating core concepts from <strong>AP Physics C (Mechanics)</strong> and <strong>AP Calculus BC</strong>. Every aspect of the simulation is grounded in rigorous vector calculus and differential equations.</p>
    <h3>PHYSICS FOUNDATION</h3>
    <p><span class="highlight">Newton's Law of Universal Gravitation</span> in vector form: each pair of particles exerts an attractive force along the line connecting them. The magnitude is proportional to the product of their masses and inversely proportional to the square of their separation.</p>
    <div class="equation">${renderFormula(eq.F_ij)}</div>
    <p>The <span class="highlight">superposition principle</span> states that the net force on a particle is the vector sum of all individual gravitational forces. For a system of N particles, this requires ${renderInline("O(N^2)")} pairwise interactions per time step.</p>
    <div class="equation">${renderFormula(eq.F_net)}</div>
    <p>Newton's second law provides the acceleration: ${renderFormula(eq.accel_vec)}. The resulting equations of motion form a coupled system of second‑order ordinary differential equations.</p>
    <h3>NUMERICAL INTEGRATION (AP Calculus BC)</h3>
    <p>Because an analytic solution exists only for the two‑body problem, we must approximate the solution numerically. We employ the <span class="highlight">Leapfrog (Störmer‑Verlet) method</span>, a second‑order symplectic integrator. Unlike naive Euler integration, symplectic methods approximately conserve the total energy of the system over long timescales — a critical property for orbital simulations.</p>
    <p>The algorithm splits each time step ${renderInline("\\Delta t")} into three stages:</p>
    <div class="equation">${renderFormula(eq.leapfrog1)}</div>
    <p>After updating positions, accelerations are recomputed from the new configuration, and the velocity receives its second half‑kick:</p>
    <div class="equation">${renderFormula(eq.leapfrog2)}</div>
    <p>The time step <span class="highlight">Δt</span> directly controls the truncation error of the integration. As Δt increases, the local error grows, manifesting as a steady drift in total energy — a vivid demonstration of numerical instability.</p>
    <h3>CONTROL PARAMETERS</h3>
    <p><span class="highlight">G (Gravitational Constant):</span> Scales the overall strength of gravitational interaction. In our normalized units, ${renderInline("G = 0.5")} yields visually pleasing orbital speeds.</p>
    <p><span class="highlight">Softening ε:</span> Introduced to regularize the singularity as ${renderInline("r_{ij} \\to 0")}. The modified force law is:</p>
    <div class="equation">${renderFormula(eq.force_soft)}</div>
    <p>Without softening, particles on near‑collision trajectories would experience arbitrarily large accelerations, violating energy conservation and causing unphysical ejections.</p>
    <p><span class="highlight">Δt (Time Step):</span> The fundamental integration step size.</p>
    <p><span class="highlight">Sub‑steps per frame:</span> Divides each Δt into multiple smaller increments, effectively reducing the integration error without slowing down the visual playback.</p>
    <h3>GALACTIC NUCLEUS & BLACK HOLE</h3>
    <p>The simulation initializes with a central particle of mass 20,000 — significantly larger than the average stellar particle. This represents the dense galactic nucleus or a seed supermassive black hole, consistent with observations that most galaxies harbor a central massive object.</p>
    <p>Clicking <span class="highlight">"Inject Black Hole"</span> selects a distant particle, sets its mass to the configured <span class="highlight">Singular Mass</span> (default 150,000), and zeroes its velocity. This simulates a rogue supermassive black hole plunging through the galaxy, often ejecting nearby particles via the gravitational slingshot effect.</p>
    <h3>ENERGY DRIFT</h3>
    <p>Total mechanical energy is the sum of kinetic and gravitational potential energies:</p>
    <div class="equation">${renderFormula(eq.energy)}</div>
    <p>Monitoring the relative change in total energy over time validates the integrator's performance. A well‑tuned Leapfrog integrator should exhibit energy drift well below 0.1% per thousand steps.</p>
  `,
	intermediate: `
    <p>A multi‑threaded particle simulation aligned with <strong>AP Physics 1</strong> (algebra‑based) and <strong>AP Calculus AB</strong>. The core principles are explained without vector calculus, though the underlying simulation still uses full 3D vectors.</p>
    <h3>PHYSICS (AP Physics 1)</h3>
    <p><span class="highlight">Newton's Law of Universal Gravitation:</span> the gravitational force between two point masses is directly proportional to the product of their masses and inversely proportional to the square of the distance between their centers.</p>
    <div class="equation">${renderFormula(eq.F_simple)}</div>
    <p>Each particle experiences a <span class="highlight">net force</span> that is the vector sum of all gravitational pulls from every other particle. Using Newton's second law (${renderFormula(eq.sigma_f)}), we find the acceleration of each particle:</p>
    <div class="equation">${renderFormula(eq.accel)}</div>
    <p>Because the forces depend on the instantaneous positions of all particles, the acceleration changes continuously. We cannot write a simple closed‑form function for position versus time.</p>
    <h3>CALCULUS (AP Calculus AB)</h3>
    <p>Acceleration is the derivative of velocity, and velocity is the derivative of position. To approximate the motion, we use <span class="highlight">numerical integration</span> — breaking time into small intervals ${renderInline("\\Delta t")} and assuming acceleration is nearly constant during each interval. This is analogous to a Riemann sum: we approximate the continuous change by summing many tiny increments.</p>
    <p>The <span class="highlight">Leapfrog method</span> improves upon the basic Euler method by evaluating velocity at the midpoint of each time step, which substantially improves energy conservation.</p>
    <div class="equation">${renderFormula(eq.v_half)}</div>
    <div class="equation">${renderFormula(eq.x_new)}</div>
    <p>A larger ${renderInline("\\Delta t")} makes the simulation run faster but increases the approximation error — watch the <span class="highlight">Energy Drift</span> percentage to see the cumulative effect.</p>
    <h3>GALACTIC NUCLEUS & BLACK HOLE</h3>
    <p>The simulation begins with a central massive particle (mass 20,000) representing the dense core of a galaxy. Most real galaxies contain a supermassive black hole or a compact star cluster at their center.</p>
    <p>Clicking <span class="highlight">"Inject Black Hole"</span> selects a distant particle and sets its mass to the value from the <span class="highlight">Singular Mass</span> slider (default 150,000). This simulates a wandering supermassive black hole, causing nearby particles to be flung outward at high speeds due to the gravitational slingshot effect.</p>
    <h3>CONTROLS</h3>
    <p><span class="highlight">G:</span> Gravitational constant — scales the strength of gravity.</p>
    <p><span class="highlight">ε (softening):</span> Prevents unrealistically large accelerations when particles pass very close to one another.</p>
    <p><span class="highlight">Δt:</span> Time step for integration. Decreasing Δt improves accuracy at the cost of slower visual progression.</p>
    <p><span class="highlight">Inject Black Hole:</span> Turns a distant particle into a supermassive black hole, dramatically warping the surrounding orbits.</p>
  `,
	middle: `
    <p>A computer model of a galaxy, built using <strong>Algebra I & II</strong> and introductory physical science concepts. No calculus is required to understand the core ideas.</p>
    <h3>GRAVITY: THE INVERSE‑SQUARE LAW</h3>
    <p>The force of gravity between two objects depends on their masses and the distance between them. If you double the distance, the force becomes one‑fourth as strong. This is called an <span class="highlight">inverse‑square relationship</span>.</p>
    <div class="equation">${renderFormula(eq.F_basic)}</div>
    <p>In this simulation, every star pulls on every other star. The computer adds up all these individual pulls to find the <span class="highlight">net force</span> on each star. That net force determines how the star accelerates.</p>
    <h3>FROM FORCE TO MOTION</h3>
    <p>Using the formula ${renderInline("a = F/m")}, we find the acceleration of each star. Then we update its velocity and position over a small time interval ${renderInline("\\Delta t")} (for example, 0.016 seconds):</p>
    <div class="equation">${renderFormula(eq.velocity_update)}</div>
    <div class="equation">${renderFormula(eq.position_update)}</div>
    <p>This process repeats hundreds of times per second. Because we are summing tiny changes over time, we call it <span class="highlight">numerical integration</span>. It is like making a flipbook: each page shows the stars shifted by a tiny amount.</p>
    <h3>WHY "SOFTENING"?</h3>
    <p>When two stars get extremely close, the ${renderInline("1/r^2")} term would become enormous, causing them to shoot apart at unrealistic speeds. We add a small positive number ${renderInline("\\varepsilon")} to the distance to keep the calculation stable.</p>
    <h3>THE CENTER OF THE GALAXY</h3>
    <p>The galaxy starts with a very massive star at its center (about 8,000 times heavier than a normal star). This represents the dense core found in real galaxies. Pressing <span class="highlight">"Inject Black Hole"</span> turns a distant star into an even heavier black hole, which can fling nearby stars away at high speeds.</p>
    <h3>SLIDERS & BUTTONS</h3>
    <p><span class="highlight">G:</span> Adjusts the overall strength of gravity.</p>
    <p><span class="highlight">ε (softening):</span> Controls how much we smooth out very close encounters.</p>
    <p><span class="highlight">Δt:</span> Changes the size of the time step. Larger steps make the simulation run faster but may look jerky or physically inaccurate.</p>
    <p><span class="highlight">Inject Black Hole:</span> Transforms a distant star into an extremely massive object, dramatically warping the orbits of surrounding stars.</p>
  `,
	basic: `
    <p>This is a model of stars moving under the force of gravity. No advanced math is required to enjoy it!</p>
    <h3>WHAT IS GRAVITY?</h3>
    <p>Gravity is an attractive force between objects that have mass. <span class="highlight">More mass means a stronger pull. Closer together means a stronger pull.</span></p>
    <div class="equation">${renderFormula(eq.F_basic, true)}</div>
    <p>The equation shows that force depends on both masses and the distance between them.</p>
    <h3>HOW DOES THE COMPUTER MOVE THE STARS?</h3>
    <p>The computer looks at where every star is, figures out how hard they are pulling on each other, and then nudges each star by a very small amount. It repeats this process over and over — just like a flipbook — to create smooth motion.</p>
    <h3>THE BIG STAR IN THE MIDDLE</h3>
    <p>Right from the start, there is a very heavy star at the center of the galaxy. This is like the center of a real galaxy, where a supermassive black hole or a dense cluster of stars usually sits. Pressing <span class="highlight">"Inject Black Hole"</span> makes a distant star even heavier, causing nearby stars to be thrown outward.</p>
    <h3>WHAT DO THE SLIDERS DO?</h3>
    <p><span class="highlight">G:</span> Makes gravity stronger or weaker.</p>
    <p><span class="highlight">ε (epsilon):</span> Prevents stars from flying away unrealistically fast when they get too close.</p>
    <p><span class="highlight">Δt (delta t):</span> Changes the size of the nudge. Bigger nudges make the simulation run faster but can look less smooth.</p>
    <p><span class="highlight">Inject Black Hole:</span> Puts a super heavy star in the outer galaxy, which strongly attracts everything around it.</p>
    <h3>COLORS</h3>
    <p>Blue stars are moving slowly. Red and orange stars are moving fast. The glow makes fast‑moving regions stand out.</p>
  `,
	tech: `
    <h3>FRONTEND & RENDERING</h3>
    <p><span class="tech-badge">Three.js r184</span> <span class="tech-badge">postprocessing v6.39</span></p>
    <p>WebGL rendering with the UnrealBloomPass effect produces a vivid neon glow. No custom GLSL shaders are used — the entire rendering pipeline is configured via standard Three.js and postprocessing APIs.</p>
    <h3>UI & CONTROLS</h3>
    <p><span class="tech-badge">lil‑gui v0.21</span></p>
    <p>A floating control panel generated entirely by lil‑gui. No custom CSS is required for the controls, ensuring a clean separation between presentation and logic.</p>
    <h3>MATHEMATICAL NOTATION</h3>
    <p><span class="tech-badge">KaTeX v0.16.45</span></p>
    <p>All equations are rendered at runtime using KaTeX, a fast, self‑contained LaTeX renderer that does not rely on external web fonts or services.</p>
    <h3>BUILD TOOLCHAIN</h3>
    <p><span class="tech-badge">Vite v8</span> <span class="tech-badge">TypeScript v6</span></p>
    <p>The project is built with Vite, providing instant hot module replacement during development and optimized production builds. TypeScript enforces strict type safety across the entire codebase.</p>
    <h3>CONCURRENCY & PERFORMANCE</h3>
    <p><span class="tech-badge">Web Workers</span> <span class="tech-badge">Float32Array</span> <span class="tech-badge">Transferables</span></p>
    <p>The ${renderInline("O(N^2)")} force calculation is distributed across all available CPU cores using Web Workers. Particle data is stored in flat Float32Array buffers and transferred between threads via zero‑copy transferable objects, minimizing memory overhead and garbage collection pauses. This architecture makes the simulation an effective <span class="highlight">benchmark for parallel JavaScript performance</span>.</p>
    <h3>BENCHMARKING CAPABILITIES</h3>
    <p>This simulation can be used to measure several performance metrics:</p>
    <ul>
      <li><span class="highlight">Throughput:</span> Frames per second (FPS) at various particle counts.</li>
      <li><span class="highlight">Latency:</span> Frame time in milliseconds — the total time required for one physics step plus rendering.</li>
      <li><span class="highlight">Scalability:</span> The speedup ratio achieved by increasing the number of Web Workers.</li>
      <li><span class="highlight">Numerical Stability:</span> Energy drift percentage, which quantifies integration error over time.</li>
    </ul>
    <p>Adjust the <span class="highlight">Particle Count</span> slider (up to 20,000 particles) to stress‑test your CPU and observe how JavaScript handles heavy computational loads.</p>
    <h3>PHYSICS CORE</h3>
    <p>A Leapfrog (Störmer‑Verlet) integrator is implemented in pure TypeScript. Data is stored in a flat Float32Array to maximize cache efficiency and minimize garbage collection overhead.</p>
    <h3>DEPENDENCIES</h3>
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
