"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordDialog } from "@/components/PasswordDialog";
import {
  MAX_PDF_BYTES,
  SOFT_WARN_PDF_BYTES,
} from "@/lib/config";
import { newSessionId, saveDeckSession } from "@/lib/deck-store";
import { rememberSessionPassword } from "@/lib/session-password";
import {
  openPdfDocument,
  PdfOpenError,
  PdfPasswordIncorrectError,
  PdfPasswordRequiredError,
} from "@/lib/pdf/load-document";

export function DeckOpenPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<{ bytes: ArrayBuffer; name: string; size: number } | null>(
    null,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const finishOpen = useCallback(
    async (bytes: ArrayBuffer, name: string, size: number, password?: string) => {
      const doc = await openPdfDocument(bytes, password);
      const id = newSessionId();
      await saveDeckSession({
        id,
        fileName: name,
        fileSize: size,
        pageCount: doc.numPages,
        createdAt: Date.now(),
        pdfBytes: bytes,
      });
      if (password) rememberSessionPassword(id, password);
      router.push(`/session/${id}`);
    },
    [router],
  );

  const processFile = useCallback(
    async (file: File, password?: string) => {
      setError(null);
      setSizeWarning(null);

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Choose a PDF file.");
        return;
      }
      if (file.size > MAX_PDF_BYTES) {
        setError(
          `This file is ${formatMb(file.size)} MB. The maximum is ${formatMb(MAX_PDF_BYTES)} MB.`,
        );
        return;
      }
      if (file.size >= SOFT_WARN_PDF_BYTES) {
        setSizeWarning(
          `Large file (${formatMb(file.size)} MB) — opening may take a moment on older devices.`,
        );
      }

      setBusy(true);
      let bytes: ArrayBuffer | null = null;
      try {
        bytes = await file.arrayBuffer();
        await finishOpen(bytes, file.name, file.size, password);
        pendingRef.current = null;
        setPasswordOpen(false);
      } catch (e) {
        if (e instanceof PdfPasswordRequiredError && bytes) {
          pendingRef.current = {
            bytes,
            name: file.name,
            size: file.size,
          };
          setPasswordOpen(true);
          setPasswordError(null);
          return;
        }
        if (e instanceof PdfPasswordIncorrectError) {
          setPasswordOpen(true);
          setPasswordError("Incorrect password. Try again.");
          return;
        }
        if (e instanceof PdfOpenError) {
          setError(e.message);
          return;
        }
        setError(
          e instanceof Error ? e.message : "Could not open this PDF.",
        );
      } finally {
        setBusy(false);
      }
    },
    [finishOpen],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onPasswordSubmit = useCallback(
    async (password: string) => {
      const pending = pendingRef.current;
      if (!pending) return;
      setBusy(true);
      setPasswordError(null);
      try {
        await finishOpen(
          pending.bytes,
          pending.name,
          pending.size,
          password,
        );
        pendingRef.current = null;
        setPasswordOpen(false);
      } catch (e) {
        if (e instanceof PdfPasswordIncorrectError) {
          setPasswordError("Incorrect password. Try again.");
        } else if (e instanceof PdfPasswordRequiredError) {
          setPasswordError("A password is required.");
        } else {
          setPasswordError(
            e instanceof Error ? e.message : "Could not open this PDF.",
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [finishOpen],
  );

  return (
    <>
      <section
        className="rounded-2xl border border-zinc-700 bg-zinc-900/50 p-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div
          className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-600 px-6 py-10 text-center"
        >
          <p className="text-sm text-zinc-400">
            Drop a PDF here, or choose a file (max {formatMb(MAX_PDF_BYTES)} MB)
          </p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500">
            {busy ? "Opening…" : "Choose PDF"}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={busy}
              onChange={onPick}
            />
          </label>
        </div>

        <p className="mt-4 text-xs text-zinc-500" role="note">
          Your PDF stays in this browser (IndexedDB). It is not uploaded to a
          server.
        </p>

        {sizeWarning ? (
          <p className="mt-3 text-sm text-amber-400" role="status">
            {sizeWarning}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <PasswordDialog
        open={passwordOpen}
        error={passwordError}
        busy={busy}
        onSubmit={(pw) => void onPasswordSubmit(pw)}
        onCancel={() => {
          setPasswordOpen(false);
          setPasswordError(null);
          pendingRef.current = null;
        }}
      />
    </>
  );
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}
