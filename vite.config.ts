import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

const isProd = process.env.NODE_ENV == "production";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ViteImageOptimizer()],
  base: isProd ? "/DataLeadWeb-frontend" : "/",
});
