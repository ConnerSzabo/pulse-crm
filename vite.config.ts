import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async ({ mode }) => {
  const isProduction = mode === "production";
  const isReplit = process.env.REPL_ID !== undefined;

  const extraPlugins: any[] = [];

  // Replit-only dev plugins — never load in production builds
  if (!isProduction && isReplit) {
    const [runtimeErrorModal, { cartographer }, { devBanner }] =
      await Promise.all([
        import("@replit/vite-plugin-runtime-error-modal"),
        import("@replit/vite-plugin-cartographer"),
        import("@replit/vite-plugin-dev-banner"),
      ]);
    extraPlugins.push(
      runtimeErrorModal.default(),
      cartographer(),
      devBanner(),
    );
  }

  return {
    plugins: [react(), ...extraPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
