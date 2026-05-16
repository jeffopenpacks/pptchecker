"use client";

import { useCallback, useEffect, useRef } from "react";

import { drawStrokes, normPoint } from "@/lib/ink-draw";
import type { InkStroke, LaserPosition, NormPoint } from "@/lib/overlay-types";

export type OverlayTool = "none" | "laser" | "pen" | "highlighter";

type Props = {
  tool: OverlayTool;
  strokes: InkStroke[];
  onStrokesChange?: (strokes: InkStroke[]) => void;
  laserPosition?: LaserPosition;
  onLaserMove?: (position: LaserPosition) => void;
  interactive?: boolean;
};

export function InkOverlay({
  tool,
  strokes,
  onStrokesChange,
  laserPosition,
  onLaserMove,
  interactive = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<{
    points: NormPoint[];
    tool: "pen" | "highlighter";
  } | null>(null);

  const paint = useCallback(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const rect = root.getBoundingClientRect();
    const w = Math.max(Math.floor(rect.width), 1);
    const h = Math.max(Math.floor(rect.height), 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStrokes(ctx, strokes, w, h);
  }, [strokes]);

  useEffect(() => {
    paint();
    const ro = new ResizeObserver(() => paint());
    const root = rootRef.current;
    if (root) ro.observe(root);
    return () => ro.disconnect();
  }, [paint]);

  const finishStroke = useCallback(() => {
    const draft = drawingRef.current;
    drawingRef.current = null;
    if (!draft || draft.points.length < 2 || !onStrokesChange) return;
    const stroke: InkStroke = {
      tool: draft.tool,
      color: draft.tool === "highlighter" ? "#facc15" : "#ef4444",
      width: draft.tool === "highlighter" ? 14 : 3,
      points: draft.points,
    };
    onStrokesChange([...strokes, stroke]);
  }, [onStrokesChange, strokes]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || !rootRef.current) return;
    if (tool === "laser") return;
    if (tool !== "pen" && tool !== "highlighter") return;
    const p = normPoint(rootRef.current, e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = { points: [p], tool };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root) return;

    if (tool === "laser" && onLaserMove) {
      onLaserMove(normPoint(root, e.clientX, e.clientY));
      return;
    }

    const draft = drawingRef.current;
    if (!draft) return;
    const p = normPoint(root, e.clientX, e.clientY);
    if (!p) return;
    draft.points.push(p);
    paint();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const rect = root.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    drawStrokes(ctx, [...strokes, {
      tool: draft.tool,
      color: draft.tool === "highlighter" ? "#facc15" : "#ef4444",
      width: draft.tool === "highlighter" ? 14 : 3,
      points: draft.points,
    }], w, h);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (tool === "laser") {
      onLaserMove?.(null);
      return;
    }
    if (drawingRef.current) {
      finishStroke();
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onPointerLeave = () => {
    if (tool === "laser") onLaserMove?.(null);
    if (drawingRef.current) finishStroke();
  };

  const active = tool !== "none";

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 ${active && interactive ? "cursor-crosshair" : "pointer-events-none"}`}
      style={{ pointerEvents: active && interactive ? "auto" : "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      aria-hidden={!active}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {laserPosition ? (
        <div
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.8)]"
          style={{
            left: `${laserPosition.x * 100}%`,
            top: `${laserPosition.y * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}
