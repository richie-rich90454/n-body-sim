import { defineConfig } from "vite";
export default defineConfig({
    base: "/n-body-sim/",
    build: {
        target: "es2015",
        minify: "oxc",
        cssMinify: "lightningcss",
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes("node_modules/three")) return "three";
                    if (id.includes("node_modules/postprocessing")) return "postprocessing";
                    if (id.includes("node_modules/katex")) return "katex";
                    if (id.includes("node_modules/lil-gui")) return "lil-gui";
                    if (id.includes("node_modules/chroma-js")) return "chroma-js";
                    if (id.includes("node_modules/@mermaid-js")) return "mermaid-core";
                    if (id.includes("node_modules/mermaid")) return "mermaid-core";
                    if (id.includes("node_modules/dagre") || id.includes("node_modules/d3"))
                        return "mermaid-deps";
                    if (id.includes("node_modules")) return "vendor";
                },
                codeSplitting: true
            },
            treeshake: {
                moduleSideEffects: (id) => {
                    if (id.includes("node_modules/chroma-js")) return false;
                    if (id.includes("node_modules/katex")) return false;
                    if (id.includes("node_modules/lil-gui")) return false;
                    return true;
                },
            },
        },
    },
    css: {
        transformer: "lightningcss",
        lightningcss: {
            targets: {
                chrome: 80,
                firefox: 75,
                safari: 14,
                edge: 90,
            },
        },
    },
    worker: {
        format: "es",
        plugins: () => [],
    },
    server: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
});
