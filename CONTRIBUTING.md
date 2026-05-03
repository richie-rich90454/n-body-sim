# Contributing Guide

Thank you for your interest in contributing to **N-Body Gravitational Dynamics**. This project combines physics, numerical methods, and modern web technologies, so contributions of many kinds are valuable—whether it's fixing bugs, improving performance, enhancing visuals, or refining documentation.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Philosophy](#project-philosophy)
- [Types of Contributions](#types-of-contributions)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

---

## Getting Started

1. Fork the repository
2. Clone your fork:

    ```bash
    git clone https://github.com/your-username/nbody-sim.git
    cd nbody-sim
    ```

3. Install dependencies:

    ```bash
    npm install
    ```

4. Start development server:

    ```bash
    npm run dev
    ```

---

## Development Setup

### Requirements

- Node.js ≥ 18
- A modern browser (Chrome / Edge / Safari recommended for WebGPU)

### Build Commands

```bash
npm run dev      # development server (HMR)
npm run build    # production build
npm run preview  # preview production build
```

---

## Project Philosophy

This project prioritizes:

- **Physical correctness** over shortcuts
- **Deterministic behavior** (CPU and GPU paths should match)
- **Performance transparency** (no hidden approximations)
- **Educational clarity** (clean math, readable structure)

Avoid introducing:

- Approximate solvers (e.g., Barnes–Hut) unless explicitly scoped
- Hidden state mutations
- Non-deterministic parallel logic

---

## Types of Contributions

### 🧠 Physics / Math

- Improve numerical stability
- Add new integration schemes (must be well-justified)
- Improve energy conservation

### ⚡ Performance

- Optimize WebGPU shaders
- Improve memory layout / cache behavior
- Reduce CPU-GPU sync overhead

### 🎨 Visuals

- Shader improvements
- Post-processing effects
- Better color mapping or particle rendering

### 🧩 Features

- New UI controls
- Additional diagnostics (e.g., angular momentum)
- Better educational explanations

### 🐛 Bug Fixes

- CPU/GPU mismatch issues
- Race conditions in workers
- Rendering artifacts

### 📚 Documentation

- README improvements
- Better explanations (AP → advanced levels)
- Code comments

---

## Coding Standards

### General

- Use **TypeScript strict mode**
- Prefer **pure functions** where possible
- Avoid unnecessary allocations in hot paths
- Keep simulation logic separate from rendering

### Formatting

- Prettier is enforced:

    ```bash
    npx prettier --write .
    ```

### Naming

- Use descriptive names:
    - `computeAcceleration` ✅
    - `doStuff` ❌

### Structure

- `simulation/` → physics + execution
- `visuals/` → rendering only
- `math/` → reusable math/initialization logic

---

## Commit Guidelines

Follow a clean, consistent format:

```
type(scope): short description
```

### Examples

- `feat(webgpu): add fused leapfrog compute pass`
- `fix(cpu): resolve worker synchronization bug`
- `docs(readme): correct LaTeX rendering`
- `perf(simulation): reduce buffer copies`

### Types

- `feat` – new feature
- `fix` – bug fix
- `perf` – performance improvement
- `docs` – documentation
- `refactor` – code restructuring
- `chore` – tooling / config

---

## Pull Request Process

1. Create a feature branch:

    ```bash
    git checkout -b feature/my-change
    ```

2. Make your changes

3. Ensure:
    - Code builds successfully
    - No TypeScript errors
    - Formatting is clean
    - CPU and GPU paths behave consistently

4. Commit and push:

    ```bash
    git push origin feature/my-change
    ```

5. Open a Pull Request with:
    - Clear description
    - Screenshots (if visual changes)
    - Performance notes (if applicable)

---

### Review Criteria

Your PR will be evaluated based on:

- Correctness (physics + logic)
- Performance impact
- Code clarity
- Consistency with project architecture

---

## Reporting Issues

When opening an issue, include:

- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Browser + OS
- Screenshots or logs if relevant

---

## Additional Notes

- Keep PRs focused—avoid mixing unrelated changes
- Large features should be discussed in an issue first
- Respect the existing architecture unless proposing a justified redesign

---

## Acknowledgement

Contributions help improve both the **technical quality** and **educational value** of this project. Thanks for taking the time to contribute.
