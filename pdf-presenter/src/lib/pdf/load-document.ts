import type { PDFDocumentProxy } from "pdfjs-dist";

import { pdfDocumentInitOptions } from "./document-options";
import { ensurePdfWorker } from "./setup";

export class PdfPasswordRequiredError extends Error {
  constructor() {
    super("PDF_PASSWORD_REQUIRED");
    this.name = "PdfPasswordRequiredError";
  }
}

export class PdfPasswordIncorrectError extends Error {
  constructor() {
    super("PDF_PASSWORD_INCORRECT");
    this.name = "PdfPasswordIncorrectError";
  }
}

export class PdfOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfOpenError";
  }
}

async function getPdfJs() {
  if (typeof window === "undefined") {
    throw new PdfOpenError("PDF can only be opened in the browser.");
  }
  await ensurePdfWorker();
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export async function openPdfDocument(
  data: ArrayBuffer,
  password?: string,
): Promise<PDFDocumentProxy> {
  const { getDocument } = await getPdfJs();
  const task = getDocument(pdfDocumentInitOptions(data, password));

  try {
    return await task.promise;
  } catch (err: unknown) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: string }).name)
        : "";

    if (name === "PasswordException") {
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as { code: number }).code)
          : 0;
      if (code === 2) throw new PdfPasswordIncorrectError();
      throw new PdfPasswordRequiredError();
    }

    const message =
      err instanceof Error ? err.message : "Could not open this PDF.";
    throw new PdfOpenError(message);
  }
}
