"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

import { PdfSlideCanvas } from "@/components/PdfSlideCanvas";
import {
  InkOverlay,
  type OverlayTool,
} from "@/components/InkOverlay";
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
  return (
    <div
      className={`relative flex h-full min-h-[200px] w-full items-center justify-center ${className ?? ""}`}
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
  );
}
