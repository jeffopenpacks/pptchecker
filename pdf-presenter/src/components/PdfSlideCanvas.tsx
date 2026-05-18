"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import {
  containerSizeReady,
  isRenderCancelledError,
  renderPageToCanvas,
} from "@/lib/pdf/render-page";

type Props = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  className?: string;
};

const RESIZE_DEBOUNCE_MS = 120;

/** Wait until flex/grid layout has assigned real dimensions. */
function afterLayout( fn: () => void ): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

export function PdfSlideCanvas({ doc, pageNumber, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeTaskRef = useRef<RenderTask | null>(null);
  const drawGenerationRef = useRef(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let layoutRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let unmounted = false;

    async function draw() {
      if (!container || !canvas || unmounted) return;

      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (!containerSizeReady(w, h)) {
        layoutRetryTimer = setTimeout(() => afterLayout(() => void draw()), 0);
        return;
      }

      const generation = ++drawGenerationRef.current;

      try {
        await renderPageToCanvas(
          doc,
          pageNumber,
          canvas,
          w,
          h,
          activeTaskRef,
        );
        if (generation === drawGenerationRef.current && !unmounted) {
          setRenderError(null);
          setVisible(true);
        }
      } catch (e) {
        if (isRenderCancelledError(e)) return;
        if (generation === drawGenerationRef.current && !unmounted) {
          setRenderError(
            e instanceof Error ? e.message : "Could not render this slide.",
          );
        }
      }
    }

    function scheduleDraw() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => afterLayout(() => void draw()), RESIZE_DEBOUNCE_MS);
    }

    setVisible(false);
    afterLayout(() => void draw());

    const ro = new ResizeObserver(() => scheduleDraw());
    ro.observe(container);

    return () => {
      unmounted = true;
      drawGenerationRef.current += 1;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (layoutRetryTimer) clearTimeout(layoutRetryTimer);
      ro.disconnect();
      if (activeTaskRef.current) {
        activeTaskRef.current.cancel();
        activeTaskRef.current = null;
      }
    };
  }, [doc, pageNumber]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full ${className ?? ""}`}
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      {renderError ? (
        <p
          className="absolute inset-x-4 bottom-4 rounded-lg bg-rose-950/90 px-3 py-2 text-center text-sm text-rose-200"
          role="alert"
        >
          {renderError}
        </p>
      ) : null}
    </div>
  );
}
