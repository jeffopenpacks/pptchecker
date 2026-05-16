/** Normalised 0–1 coordinates relative to slide overlay box. */
export type NormPoint = { x: number; y: number };

export type InkTool = "pen" | "highlighter";

export type InkStroke = {
  tool: InkTool;
  color: string;
  width: number;
  points: NormPoint[];
};

export type SessionOverlays = {
  sessionId: string;
  /** Index 0 = slide 1 */
  bySlide: InkStroke[][];
};

export type LaserPosition = { x: number; y: number } | null;
