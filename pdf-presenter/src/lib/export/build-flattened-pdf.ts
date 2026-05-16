import { PDFDocument } from "pdf-lib";

import type { ExportedPageBitmap } from "./render-page-for-export";

export async function buildFlattenedPdf(
  pages: ExportedPageBitmap[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const page of pages) {
    const image = await doc.embedPng(page.pngBytes);
    const pdfPage = doc.addPage([page.width, page.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });
  }

  return doc.save();
}
