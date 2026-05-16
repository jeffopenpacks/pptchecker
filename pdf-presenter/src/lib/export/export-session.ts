import { loadDeckSession, type StoredSession } from "@/lib/deck-store";
import { openPdfDocument } from "@/lib/pdf/load-document";
import { loadSessionNotes } from "@/lib/notes-store";
import { loadSessionOverlays } from "@/lib/overlay-store";
import { getSessionPassword } from "@/lib/session-password";

import { buildFlattenedPdf } from "./build-flattened-pdf";
import {
  downloadBytes,
  downloadBlob,
  safeExportBasename,
} from "./download";
import { renderPageForExport } from "./render-page-for-export";

export type ExportProgress = {
  current: number;
  total: number;
  label: string;
};

export type NotesExportPayload = {
  version: 1;
  sessionId: string;
  fileName: string;
  pageCount: number;
  exportedAt: string;
  slides: { slide: number; notes: string }[];
};

export async function loadSessionForExport(
  sessionId: string,
): Promise<StoredSession> {
  const session = await loadDeckSession(sessionId);
  if (!session) throw new Error("Deck not found.");
  return session;
}

export function exportOriginalPdf(session: StoredSession): void {
  const base = safeExportBasename(session.fileName);
  const bytes = new Uint8Array(session.pdfBytes);
  downloadBytes(bytes, `${base}.pdf`, "application/pdf");
}

export async function exportFlattenedPdf(
  sessionId: string,
  onProgress?: (progress: ExportProgress) => void,
): Promise<void> {
  const session = await loadSessionForExport(sessionId);
  const overlays = await loadSessionOverlays(sessionId);
  const password = getSessionPassword(sessionId);

  const doc = await openPdfDocument(session.pdfBytes, password);
  const total = doc.numPages;
  const pages = [];

  try {
    for (let slide = 1; slide <= total; slide += 1) {
      onProgress?.({
        current: slide,
        total,
        label: `Rendering slide ${slide} of ${total}`,
      });
      const strokes = overlays.bySlide[slide - 1] ?? [];
      pages.push(await renderPageForExport(doc, slide, strokes));
    }

    onProgress?.({
      current: total,
      total,
      label: "Building PDF…",
    });

    const pdfBytes = await buildFlattenedPdf(pages);
    const base = safeExportBasename(session.fileName);
    downloadBytes(pdfBytes, `${base}-marked.pdf`, "application/pdf");
  } finally {
    void doc.destroy();
  }
}

export async function exportNotesJson(sessionId: string): Promise<void> {
  const session = await loadSessionForExport(sessionId);
  const notes = await loadSessionNotes(sessionId);

  const payload: NotesExportPayload = {
    version: 1,
    sessionId,
    fileName: session.fileName,
    pageCount: session.pageCount,
    exportedAt: new Date().toISOString(),
    slides: Array.from({ length: session.pageCount }, (_, i) => ({
      slide: i + 1,
      notes: notes.bySlide[i] ?? "",
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  const base = safeExportBasename(session.fileName);
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    `${base}-notes.json`,
  );
}
