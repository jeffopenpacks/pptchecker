"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { PdfSlideCanvas } from "@/components/PdfSlideCanvas";
import {
  InkOverlay,
  type OverlayTool,
} from "@/components/InkOverlay";
import { fitPageInBox } from "@/lib/pdf/fit-page-in-box";
import { containerSizeReady } from "@/lib/pdf/render-page";
import type { InkStroke, LaserPosition } from "@/lib/overlay-types";

type Props = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  className?: string;
  tool?: OverlayTool;
  strokes?: InkStroke[];
  onStrokesChange?: (strokes: InkStroke[]) => void;
  laserPosition?: LaserPosition;
  onLaserMove?: (position: LaserPosition) => void;
  interactiveOverlay?: boolean;
};

export function SlideStage({
  doc,
  pageNumber,
  className,
  tool = "none",
  strokes = [],
  onStrokesChange,
  laserPosition,
  onLaserMove,
  interactiveOverlay = false,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    void doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: 1 });
      setPageSize({ width: vp.width, height: vp.height });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBoxSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitted = fitPageInBox(
    pageSize.width,
    pageSize.height,
    boxSize.width,
    boxSize.height,
  );

  const frameReady =
    containerSizeReady(fitted.width, fitted.height) && pageSize.width > 0;

  return (
    <div
      ref={outerRef}
      className={`relative flex h-full min-h-[200px] w-full items-center justify-center ${className ?? ""}`}
    >
      {frameReady ? (
        <div
          className="relative shrink-0"
          style={{ width: fitted.width, height: fitted.height }}
        >
          <PdfSlideCanvas doc={doc} pageNumber={pageNumber} />
          <InkOverlay
            tool={tool}
            strokes={strokes}
            onStrokesChange={onStrokesChange}
            laserPosition={laserPosition}
            onLaserMove={onLaserMove}
            interactive={interactiveOverlay}
          />
        </div>
      ) : null}
    </div>
  );
}
