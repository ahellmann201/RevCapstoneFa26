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
            input: {
                home: rootPath("./frontend/index.html"),
                game: rootPath("./frontend/game.html"),
                account: rootPath("./frontend/account_settings.html"),
                schedule: rootPath("./frontend/schedule_event.html"),
                events: rootPath("./frontend/events.html"),
                ciclops: rootPath("./frontend/ciclops.html"),
                smartDot: rootPath("./frontend/smart_dot.html"),
                stats: rootPath("./frontend/stats.html"),
                smartWatch: rootPath("./frontend/smart_watch.html"),
                ballArsenal: rootPath("./frontend/ball_arsenal.html"),
            },
        },
    },
});
