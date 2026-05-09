/** Maximum upload size (bytes). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Heuristic bands for total ppt/media bytes ÷ reported slide count.
 * Tunable — not empirical benchmarks for every org.
 */
/** At or below this avg bytes/slide: treated as light / text-first decks. */
export const MEDIA_PER_SLIDE_TYPICAL_MAX_BYTES = 350 * 1024;

/** Above typical through this: moderate / mixed imagery. */
export const MEDIA_PER_SLIDE_MODERATE_MAX_BYTES = 2 * 1024 * 1024;

/** Above moderate through this: heavy image-rich decks. */
export const MEDIA_PER_SLIDE_HEAVY_MAX_BYTES = 8 * 1024 * 1024;

/** Central-directory entries: refuse excess (ZIP fuzz / bombs). */
export const MAX_ZIP_CENTRAL_ENTRIES = 2500;

/**
 * Sum of declared uncompressed sizes for entries we accept (from ZIP headers).
 * Pair with {@link MAX_UNZIPPED_TOTAL_BYTES} after extraction.
 */
export const MAX_ZIP_DECLARED_UNCOMPRESSED_TOTAL_BYTES = 180 * 1024 * 1024;

/** Declared uncompressed size per ZIP member — refuse larger (single-entry bomb). */
export const MAX_ZIP_SINGLE_ENTRY_UNCOMPRESSED_BYTES = 45 * 1024 * 1024;

/** Aggregate size of extracted buffers — hard stop after unzip. */
export const MAX_UNZIPPED_TOTAL_BYTES = 200 * 1024 * 1024;

/** Member path length limit inside the archive. */
export const MAX_ZIP_ENTRY_PATH_LENGTH = 512;

/**
 * Characters scanned per XML part for regex / lightweight parse heuristics.
 * Full parts remain size-capped by ZIP entry limits; this bounds CPU on pathological XML.
 */
export const MAX_XML_CHARS_SCAN_PER_PART = 450_000;

/** Slide XML parts analysed (sorted by slide index); remainder skipped with a finding. */
export const MAX_SLIDE_PARTS_TO_ANALYSE = 600;

/** Relationship parts scanned per deck (approximate CPU bound). */
export const MAX_RELS_PARTS_TO_ANALYSE = 4000;

/** Under `ppt/`, up to this many `.xml` parts are scanned for fonts (excluding `tags` folders). */
export const MAX_XML_PARTS_TO_SCAN = 4000;

/** Per-IP analyse attempts per window (see {@link ANALYSE_RATE_LIMIT_WINDOW_MS}). */
export const ANALYSE_RATE_LIMIT_MAX = 40;

export const ANALYSE_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Lower-cased families that often substitute or differ macOS ↔ Windows.
 * Heuristic only — not exhaustive.
 */
export const CROSS_PLATFORM_FONT_WATCHLIST = new Set(
  [
    "Segoe UI",
    "Segoe UI Light",
    "Segoe UI Semibold",
    "Calibri Light",
    "Candara",
    "Constantia",
    "Corbel",
    "SF Pro",
    "SF Pro Display",
    "SF Pro Text",
    "Helvetica Neue",
    "PingFang SC",
    "PingFang TC",
    "Hiragino Sans GB",
    "Songti SC",
    "Songti TC",
    "STHeiti",
    "Apple SD Gothic Neo",
    "Avenir Next",
    "Lucida Grande",
  ].map((f) => f.toLowerCase()),
);
