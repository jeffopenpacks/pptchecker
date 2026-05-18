/** Fit a PDF page (natural size) inside a box; returns display width/height in CSS px. */
export function fitPageInBox(
  pageWidth: number,
  pageHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  if (
    pageWidth < 1 ||
    pageHeight < 1 ||
    boxWidth < 1 ||
    boxHeight < 1
  ) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(boxWidth / pageWidth, boxHeight / pageHeight);
  return {
    width: Math.floor(pageWidth * scale),
    height: Math.floor(pageHeight * scale),
  };
}
