import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Include the new sidebar pages alongside the existing home entry point.
export default defineConfig({
    build: {
        rollupOptions: {
            input: ["index.html", "events.html", "ciclops.html", "smart_dot.html",
                "stats.html", "smart_watch.html", "ball_arsenal.html"]
                .map((file) => fileURLToPath(new URL(file, import.meta.url))),
        },
    },
});
