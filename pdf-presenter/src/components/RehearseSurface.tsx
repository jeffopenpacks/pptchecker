"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { SlideStage } from "@/components/SlideStage";
import type { OverlayTool } from "@/components/InkOverlay";
import { useSlideNotes } from "@/hooks/use-slide-notes";
import { useSlideOverlays } from "@/hooks/use-slide-overlays";
import { MAX_NOTE_CHARS_PER_SLIDE } from "@/lib/config";

type Props = {
  sessionId: string;
  doc: PDFDocumentProxy;
  fileName: string;
};

export function RehearseSurface({ sessionId, doc, fileName }: Props) {
  const pageCount = doc.numPages;
  const [slideIndex, setSlideIndex] = useState(1);
  const [tool, setTool] = useState<OverlayTool>("none");
  const { ready, getNote, setNote, limitWarning } = useSlideNotes(sessionId);
  const {
    ready: overlaysReady,
    getStrokes,
    setStrokes,
  } = useSlideOverlays(sessionId);

  const clamp = useCallback(
    (n: number) => Math.min(pageCount, Math.max(1, n)),
    [pageCount],
  );

  const go = useCallback(
    (n: number) => setSlideIndex(clamp(n)),
    [clamp],
  );

  const note = getNote(slideIndex);
  const strokes = getStrokes(slideIndex);

  return (
    <main
      id="main"
      className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-500/90">
            Rehearse
          </p>
          <h1 className="truncate text-sm font-medium">{fileName}</h1>
        </div>
        <Link
          href={`/session/${sessionId}`}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Present setup
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="text-xs text-zinc-500">Markup:</span>
        <ToolChip
          active={tool === "none"}
          onClick={() => setTool("none")}
          label="View"
        />
        <ToolChip
          active={tool === "pen"}
          onClick={() => setTool("pen")}
          label="Pen"
        />
        <ToolChip
          active={tool === "highlighter"}
          onClick={() => setTool("highlighter")}
          label="Highlighter"
        />
        <button
          type="button"
          onClick={() => setStrokes(slideIndex, [])}
          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          Clear slide ink
        </button>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2"
        aria-label="Slides"
      >
        {Array.from({ length: pageCount }, (_, i) => {
          const n = i + 1;
          const active = n === slideIndex;
          const hasNote = Boolean((getNote(n) || "").trim());
          const hasInk = (getStrokes(n)?.length ?? 0) > 0;
          return (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs tabular-nums ${
                active
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              aria-current={active ? "true" : undefined}
            >
              {n}
              {hasNote ? <span className="ml-0.5 text-amber-300">•</span> : null}
              {hasInk ? <span className="ml-0.5 text-rose-400">✎</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_minmax(240px,320px)]">
        <section className="flex min-h-[280px] flex-col rounded-xl border border-zinc-800 bg-black">
          <p className="border-b border-zinc-800 px-3 py-1 text-xs text-zinc-500">
            Slide {slideIndex} of {pageCount}
          </p>
          <div className="relative min-h-[240px] flex-1">
            <SlideStage
              doc={doc}
              pageNumber={slideIndex}
              tool={tool}
              strokes={strokes}
              onStrokesChange={(s) => setStrokes(slideIndex, s)}
              interactiveOverlay={tool === "pen" || tool === "highlighter"}
            />
          </div>
        </section>

        <section className="flex min-h-[200px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
          <label
            htmlFor="speaker-notes"
            className="border-b border-zinc-800 px-3 py-1 text-xs text-zinc-500"
          >
            Speaker notes (slide {slideIndex})
          </label>
          <textarea
            id="speaker-notes"
            disabled={!ready}
            value={note}
            onChange={(e) => setNote(slideIndex, e.target.value)}
            placeholder="Talking points for this slide…"
            maxLength={MAX_NOTE_CHARS_PER_SLIDE}
            className="min-h-[160px] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          {limitWarning ? (
            <p className="px-3 py-1 text-xs text-amber-400" role="status">
              {limitWarning}
            </p>
          ) : null}
          <p className="border-t border-zinc-800 px-3 py-1 text-xs text-zinc-600">
            {overlaysReady
              ? "Ink is saved on this device and appears in Present mode."
              : "Loading…"}
          </p>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 px-4 py-3">
        <button
          type="button"
          onClick={() => go(slideIndex - 1)}
          disabled={slideIndex <= 1}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-sm tabular-nums text-zinc-400">
          {slideIndex} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => go(slideIndex + 1)}
          disabled={slideIndex >= pageCount}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Next →
        </button>
      </footer>
    </main>
  );
}

function ToolChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-emerald-600 text-white"
          : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}
