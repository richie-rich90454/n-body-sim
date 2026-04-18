import { defineConfig } from "vite"

export default defineConfig({
    base: "/n-body-sim/",
    build: {
        target: "es2015",
        minify: "oxc",
        cssMinify: "lightningcss",
        rollupOptions: {
            output: {
                manualChunks: undefined
            }
        }
    },
    css: {
        transformer: "lightningcss",
        lightningcss: {
            targets: { chrome: 80, firefox: 75, safari: 14, edge: 90 }
        }
    },
    worker: {
        format: "es",
        plugins: () => []
    }
})