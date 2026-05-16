"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { ExportPanel } from "@/components/ExportPanel";
import {
  deleteDeckSession,
  loadDeckSession,
  type StoredSession,
} from "@/lib/deck-store";
import { forgetSessionPassword } from "@/lib/session-password";

export default function SessionHubPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDeckSession(sessionId).then((s) => {
      if (!s) {
        setError("Deck not found.");
        return;
      }
      setSession(s);
    });
  }, [sessionId]);

  const openAudience = useCallback(() => {
    const url = `/present/${sessionId}/audience`;
    window.open(url, "pdf-audience", "noopener,noreferrer");
  }, [sessionId]);

  const openPresenter = useCallback(() => {
    const url = `/present/${sessionId}/presenter`;
    window.open(url, "pdf-presenter", "noopener,noreferrer");
  }, [sessionId]);

  const openAudienceSameTab = useCallback(() => {
    window.location.href = `/present/${sessionId}/audience`;
  }, [sessionId]);

  const forgetDeck = useCallback(async () => {
    forgetSessionPassword(sessionId);
    await deleteDeckSession(sessionId);
    window.location.href = "/";
  }, [sessionId]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-rose-400">{error}</p>
        <Link href="/" className="mt-4 inline-block text-emerald-500 hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-lg px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Open another PDF
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-zinc-50">
        {session.fileName}
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        {session.pageCount} slides ·{" "}
        {(session.fileSize / (1024 * 1024)).toFixed(1)} MB
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Rehearse
        </h2>
        <p className="text-sm text-zinc-400">
          Add speaker notes per slide before you present. Notes appear in the
          presenter window only.
        </p>
        <Link
          href={`/rehearse/${sessionId}`}
          className="flex w-full justify-center rounded-xl border border-amber-700/60 bg-amber-950/30 py-3 text-sm font-medium text-amber-100 hover:bg-amber-950/50"
        >
          Open rehearse mode
        </Link>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Present
        </h2>
        <p className="text-sm text-zinc-400">
          For two screens: open <strong className="text-zinc-200">audience</strong> on
          the projector and <strong className="text-zinc-200">presenter</strong> on your
          laptop. Controls in the presenter window sync to the audience window.
        </p>
        <button
          type="button"
          onClick={openPresenter}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Open presenter window
        </button>
        <button
          type="button"
          onClick={openAudience}
          className="w-full rounded-xl border border-zinc-600 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-900"
        >
          Open audience window
        </button>
        <button
          type="button"
          onClick={openAudienceSameTab}
          className="w-full rounded-xl border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
        >
          Audience only (this tab)
        </button>
      </section>

      <div className="mt-10 border-t border-zinc-800 pt-8">
        <ExportPanel sessionId={sessionId} session={session} />
      </div>

      <section className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="sr-only">Privacy</h2>
        <p className="text-xs text-zinc-500">
          Your PDF, notes, and rehearsal ink stay in this browser. Nothing is
          uploaded to a server.
        </p>
        <button
          type="button"
          onClick={() => void forgetDeck()}
          className="mt-4 text-sm text-zinc-500 hover:text-rose-400"
        >
          Remove deck from this browser
        </button>
      </section>
    </main>
  );
}
