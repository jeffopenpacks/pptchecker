"use client";

import { useCallback, useId, useState } from "react";

import type { StoredSession } from "@/lib/deck-store";
import {
  exportFlattenedPdf,
  exportNotesJson,
  exportOriginalPdf,
  type ExportProgress,
} from "@/lib/export/export-session";

type Props = {
  sessionId: string;
  session: StoredSession;
};

export function ExportPanel({ sessionId, session }: Props) {
  const statusId = useId();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void> | void) => {
      if (busy) return;
      setError(null);
      setProgress(null);
      setBusy(true);
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed.");
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [busy],
  );

  return (
    <section
      className="space-y-3"
      aria-labelledby={`${statusId}-heading`}
      aria-busy={busy}
    >
      <h2
        id={`${statusId}-heading`}
        className="text-sm font-medium uppercase tracking-wide text-zinc-500"
      >
        Export
      </h2>
      <p className="text-sm text-zinc-400">
        Download the original PDF, a flattened copy with rehearsal ink burned
        in, or speaker notes as JSON. Exports run on this device only.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ExportButton
          disabled={busy}
          onClick={() => run(() => exportOriginalPdf(session))}
        >
          Original PDF
        </ExportButton>
        <ExportButton
          disabled={busy}
          onClick={() =>
            run(() =>
              exportFlattenedPdf(sessionId, (p) => setProgress(p)),
            )
          }
        >
          Flattened PDF (with ink)
        </ExportButton>
        <ExportButton
          disabled={busy}
          onClick={() => run(() => exportNotesJson(sessionId))}
        >
          Notes (JSON)
        </ExportButton>
      </div>

      {busy && progress ? (
        <p id={statusId} className="text-sm text-amber-300/90" role="status">
          {progress.label}
          {progress.total > 1
            ? ` (${progress.current} / ${progress.total})`
            : null}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      {session.pageCount > 40 ? (
        <p className="text-xs text-zinc-500">
          Large decks may take a minute to flatten on slower devices.
        </p>
      ) : null}
    </section>
  );
}

function ExportButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
