import {defineConfig} from "vite"
export default defineConfig({
    base: "/n-body-sim/",
    build: {
        target: "es2015",
        minify: "oxc",
        cssMinify: "lightningcss",
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                codeSplitting: true,
                manualChunks: (id) => {
                    if (id.includes("node_modules/three")) {
                        return "three"
                    }
                    if (id.includes("node_modules/postprocessing")) {
                        return "postprocessing"
                    }
                    if (id.includes("node_modules/katex")) {
                        return "katex"
                    }
                    if (id.includes("node_modules")) {
                        return "vendor"
                    }
                }
            }
        }
    },
    css: {
        transformer: "lightningcss",
        lightningcss: {
            targets: {
                chrome: 80,
                firefox: 75,
                safari: 14,
                edge: 90
            }
        }
    },
    worker: {
        format: "es",
        plugins: () => []
    }
})