import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export function isRenderCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "RenderingCancelledException" ||
    /cancel/i.test(error.message)
  );
}

/** Minimum container size before rendering (avoids bad first paint while flex layout settles). */
export const MIN_RENDER_CONTAINER_PX = 48;

export function containerSizeReady(width: number, height: number): boolean {
  return width >= MIN_RENDER_CONTAINER_PX && height >= MIN_RENDER_CONTAINER_PX;
}

/**
 * Renders one page. Cancels and awaits any in-flight task on the same canvas
 * before starting (PDF.js forbids overlapping render() on one canvas).
 */
export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  containerWidth: number,
  containerHeight: number,
  activeTask: { current: RenderTask | null },
): Promise<void> {
  if (activeTask.current) {
    activeTask.current.cancel();
    try {
      await activeTask.current.promise;
    } catch (e) {
      if (!isRenderCancelledError(e)) throw e;
    }
    activeTask.current = null;
  }

  const { OutputScale } = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(
    containerWidth / base.width,
    containerHeight / base.height,
  );
  const viewport = page.getViewport({ scale });

  const outputScale = new OutputScale();
  const pixelWidth = Math.floor(viewport.width * outputScale.sx);
  const pixelHeight = Math.floor(viewport.height * outputScale.sy);
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const transform = outputScale.scaled
    ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0]
    : undefined;

  const task = page.render({
    canvas,
    viewport,
    transform,
  });
  activeTask.current = task;

  try {
    await task.promise;
  } finally {
    if (activeTask.current === task) {
      activeTask.current = null;
    }
  }
}
