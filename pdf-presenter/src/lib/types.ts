import type { InkStroke, LaserPosition } from "./overlay-types";

export type DeckSessionMeta = {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  createdAt: number;
};

export type PresentBlank = "black" | "white" | null;

export type PresentState = {
  slideIndex: number;
  blank: PresentBlank;
};

export type PresentMessage =
  | { type: "state"; state: PresentState }
  | { type: "request-state" }
  | { type: "laser"; position: LaserPosition }
  | { type: "ephemeral-ink"; slideIndex: number; strokes: InkStroke[] };
