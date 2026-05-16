import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules", "pdfjs-dist");
const publicDir = join(root, "public");

mkdirSync(publicDir, { recursive: true });

// Legacy worker includes polyfills (e.g. Map.getOrInsertComputed) for Safari.
copyFileSync(
  join(pkg, "legacy", "build", "pdf.worker.min.mjs"),
  join(publicDir, "pdf.worker.min.mjs"),
);

for (const dir of ["standard_fonts", "wasm"]) {
  cpSync(join(pkg, dir), join(publicDir, dir), { recursive: true });
}
