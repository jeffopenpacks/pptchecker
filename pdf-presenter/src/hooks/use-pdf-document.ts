"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { loadDeckSession } from "@/lib/deck-store";
import {
  openPdfDocument,
  PdfPasswordIncorrectError,
  PdfPasswordRequiredError,
} from "@/lib/pdf/load-document";

export type PdfDocStatus =
  | { kind: "loading" }
  | { kind: "ready"; doc: PDFDocumentProxy; fileName: string }
  | { kind: "password" }
  | { kind: "error"; message: string };

export function usePdfDocument(
  sessionId: string,
  password?: string,
): PdfDocStatus {
  const [status, setStatus] = useState<PdfDocStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus({ kind: "loading" });
      try {
        const session = await loadDeckSession(sessionId);
        if (!session) {
          if (!cancelled) {
            setStatus({
              kind: "error",
              message: "Deck not found. Open the PDF again from the home page.",
            });
          }
          return;
        }
        const doc = await openPdfDocument(session.pdfBytes, password);
        if (!cancelled) {
          setStatus({ kind: "ready", doc, fileName: session.fileName });
        }
      } catch (e) {
        if (cancelled) return;
        if (
          e instanceof PdfPasswordRequiredError ||
          e instanceof PdfPasswordIncorrectError
        ) {
          setStatus({ kind: "password" });
          return;
        }
        setStatus({
          kind: "error",
          message:
            e instanceof Error ? e.message : "Could not load this deck.",
        });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, password]);

  return status;
}
