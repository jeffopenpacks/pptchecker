/** Maximum upload size (bytes). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Flag each media file at or above this size. */
export const LARGE_MEDIA_BYTES = 5 * 1024 * 1024;

/** Warn when total media payload exceeds this. */
export const TOTAL_MEDIA_WARN_BYTES = 30 * 1024 * 1024;

/** Very large image dimension heuristic (pixels per side). */
export const LARGE_IMAGE_DIMENSION = 6000;

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
