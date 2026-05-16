/** Hard cap — reject before reading into memory. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** Soft warning — allow opening. */
export const SOFT_WARN_PDF_BYTES = 50 * 1024 * 1024;

export const DECK_DB_NAME = "pdf-presenter-decks";
export const DECK_DB_VERSION = 3;
export const DECK_STORE = "sessions";
export const NOTES_STORE = "notes";
export const OVERLAYS_STORE = "overlays";

/** Max characters per slide speaker note. */
export const MAX_NOTE_CHARS_PER_SLIDE = 4_000;

/** Max total characters across all slides for one deck session. */
export const MAX_NOTES_TOTAL_CHARS = 200_000;

/** Max strokes stored per slide (rehearsal ink). */
export const MAX_STROKES_PER_SLIDE = 200;

/** Max points per stroke (rehearsal ink). */
export const MAX_POINTS_PER_STROKE = 2_000;
