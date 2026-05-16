import type { PDFDocumentProxy } from "pdfjs-dist";

import { drawStrokes } from "@/lib/ink-draw";
import type { InkStroke } from "@/lib/overlay-types";

/** Render scale for flattened export (2× ≈ crisp on projectors). */
export const EXPORT_RENDER_SCALE = 2;

export type ExportedPageBitmap = {
  width: number;
  height: number;
  pngBytes: Uint8Array;
};

/**
 * Renders one PDF page plus rehearsal ink to a PNG for flattening.
 * Runs in the browser only (uses canvas).
 */
export async function renderPageForExport(
  doc: PDFDocumentProxy,
  pageNumber: number,
  strokes: InkStroke[],
  scale = EXPORT_RENDER_SCALE,
): Promise<ExportedPageBitmap> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);
  canvas.width = width;
  canvas.height = height;

  const task = page.render({ canvas, viewport });
  await task.promise;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create export canvas.");
  if (strokes.length > 0) {
    drawStrokes(ctx, strokes, width, height);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) throw new Error("Could not encode slide image.");

  return {
    width,
    height,
    pngBytes: new Uint8Array(await blob.arrayBuffer()),
  };
}
