import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const rootPath = (relative) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
    root: rootPath("./frontend/"),
    server: { host: "0.0.0.0", port: 5173, strictPort: true },
    build: {
        outDir: rootPath("./dist/"),
        emptyOutDir: true,
        rollupOptions: {
            input: [
                "index.html",
                "game.html",
                "account_settings.html",
                "schedule_event.html",
                "events.html",
                "ciclops.html",
                "smart_dot.html",
                "stats.html",
                "smart_watch.html",
                "ball_arsenal.html",
            ].map((file) => rootPath(`./frontend/${file}`)),
        },
    },
});
