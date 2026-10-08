import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const server = `http://127.0.0.1:${process.env.HQ_UI_PORT ?? 4321}`;

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": server, "/raw": server },
  },
});
