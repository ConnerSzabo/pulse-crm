import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// esbuild compiles server to CJS so __dirname is always available at runtime.
// This cast silences the TypeScript error in ESM type-check mode.
declare const __dirname: string;

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
