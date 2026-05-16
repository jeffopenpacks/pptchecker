import {
  MAX_NOTE_CHARS_PER_SLIDE,
  MAX_NOTES_TOTAL_CHARS,
} from "./config";

export type NoteLimitReason = "per-slide" | "total" | null;

export function totalNoteChars(bySlide: string[]): number {
  return bySlide.reduce((sum, s) => sum + (s?.length ?? 0), 0);
}

/** Apply a slide note edit while enforcing caps (truncates if needed). */
export function applyNoteText(
  bySlide: string[],
  slideIndex: number,
  rawText: string,
): { bySlide: string[]; limitReason: NoteLimitReason } {
  let text = rawText.slice(0, MAX_NOTE_CHARS_PER_SLIDE);
  let limitReason: NoteLimitReason =
    rawText.length > MAX_NOTE_CHARS_PER_SLIDE ? "per-slide" : null;

  const next = [...bySlide];
  while (next.length < slideIndex) next.push("");

  const prevLen = next[slideIndex - 1]?.length ?? 0;
  const otherTotal = totalNoteChars(bySlide) - prevLen;
  const room = MAX_NOTES_TOTAL_CHARS - otherTotal;

  if (text.length > room) {
    text = text.slice(0, Math.max(0, room));
    limitReason = "total";
  }

  next[slideIndex - 1] = text;
  return { bySlide: next, limitReason };
}

export function limitMessage(reason: NoteLimitReason): string | null {
  if (reason === "per-slide") {
    return `Each slide is limited to ${MAX_NOTE_CHARS_PER_SLIDE.toLocaleString()} characters.`;
  }
  if (reason === "total") {
    return `Total notes for this deck are limited to ${MAX_NOTES_TOTAL_CHARS.toLocaleString()} characters.`;
  }
  return null;
}
