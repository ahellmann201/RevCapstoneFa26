import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(root, "index.html"),
        game: resolve(root, "game.html"),
        accountSettings: resolve(root, "account_settings.html"),
        scheduleEvent: resolve(root, "schedule_event.html"),
        onnxDemo: resolve(root, "onnx-demo.html"),
      },
    },
  },
});
