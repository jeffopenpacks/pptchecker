"use client";

import { useState } from "react";
import Link from "next/link";

import { PresentSurface } from "@/components/PresentSurface";
import { PasswordDialog } from "@/components/PasswordDialog";
import { usePdfDocument } from "@/hooks/use-pdf-document";
import {
  PdfPasswordIncorrectError,
  PdfPasswordRequiredError,
  openPdfDocument,
} from "@/lib/pdf/load-document";
import { loadDeckSession } from "@/lib/deck-store";
import {
  getSessionPassword,
  rememberSessionPassword,
} from "@/lib/session-password";

type Mode = "audience" | "presenter";

export function PresentLoader({
  sessionId,
  mode,
}: {
  sessionId: string;
  mode: Mode;
}) {
  const [password, setPassword] = useState<string | undefined>(() =>
    getSessionPassword(sessionId),
  );
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const status = usePdfDocument(sessionId, password);

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Loading deck…
      </div>
    );
  }

  if (status.kind === "ready") {
    return (
      <PresentSurface
        sessionId={sessionId}
        doc={status.doc}
        fileName={status.fileName}
        mode={mode}
      />
    );
  }

  if (status.kind === "password") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
        <PasswordDialog
          open
          error={passwordError}
          busy={busy}
          onSubmit={(pw) => {
            void (async () => {
              setBusy(true);
              setPasswordError(null);
              try {
                const session = await loadDeckSession(sessionId);
                if (!session) {
                  setPasswordError("Deck not found.");
                  return;
                }
                await openPdfDocument(session.pdfBytes, pw);
                rememberSessionPassword(sessionId, pw);
                setPassword(pw);
              } catch (e) {
                if (e instanceof PdfPasswordIncorrectError) {
                  setPasswordError("Incorrect password. Try again.");
                } else if (e instanceof PdfPasswordRequiredError) {
                  setPasswordError("A password is required.");
                } else {
                  setPasswordError(
                    e instanceof Error ? e.message : "Could not open PDF.",
                  );
                }
              } finally {
                setBusy(false);
              }
            })();
          }}
          onCancel={() => {
            window.location.href = "/";
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
      <p className="text-rose-400">{status.message}</p>
      <Link href="/" className="text-sm text-emerald-500 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
