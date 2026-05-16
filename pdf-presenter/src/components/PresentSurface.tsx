"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { SlideStage } from "@/components/SlideStage";
import { ShortcutHelp } from "@/components/ShortcutHelp";
import type { OverlayTool } from "@/components/InkOverlay";
import { usePresentKeyboard } from "@/hooks/use-present-keyboard";
import { useSlideNotes } from "@/hooks/use-slide-notes";
import { useSlideOverlays } from "@/hooks/use-slide-overlays";
import { PresentSync } from "@/lib/present/sync";
import type { InkStroke, LaserPosition } from "@/lib/overlay-types";
import type { PresentBlank, PresentState } from "@/lib/types";

type Mode = "audience" | "presenter";

type Props = {
  sessionId: string;
  doc: PDFDocumentProxy;
  fileName: string;
  mode: Mode;
};

export function PresentSurface({
  sessionId,
  doc,
  fileName,
  mode,
}: Props) {
  const pageCount = doc.numPages;
  const syncRef = useRef<PresentSync | null>(null);
  const stateRef = useRef<PresentState>({ slideIndex: 1, blank: null });
  const isLeader = mode === "presenter";

  const [state, setState] = useState<PresentState>({
    slideIndex: 1,
    blank: null,
  });
  stateRef.current = state;

  const [helpOpen, setHelpOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  const [goToValue, setGoToValue] = useState("");
  const [presentTool, setPresentTool] = useState<OverlayTool>("none");
  const [ephemeralStrokes, setEphemeralStrokes] = useState<InkStroke[]>([]);
  const [remoteLaser, setRemoteLaser] = useState<LaserPosition>(null);
  const [remoteInk, setRemoteInk] = useState<InkStroke[]>([]);
  const [remoteInkSlide, setRemoteInkSlide] = useState(1);
  const ephemeralRef = useRef<InkStroke[]>([]);
  ephemeralRef.current = ephemeralStrokes;

  const { ready: notesReady, getNote } = useSlideNotes(sessionId);
  const { getStrokes: getRehearsalStrokes } = useSlideOverlays(sessionId);

  const publish = useCallback(
    (next: PresentState) => {
      setState(next);
      syncRef.current?.publish(next);
    },
    [],
  );

  const publishEphemeral = useCallback(
    (slideIndex: number, strokes: InkStroke[]) => {
      syncRef.current?.publishEphemeralInk(slideIndex, strokes);
    },
    [],
  );

  useEffect(() => {
    const sync = new PresentSync(sessionId);
    syncRef.current = sync;

    sync.onState((remote) => {
      if (!isLeader) {
        setState(remote);
        if (remote.slideIndex !== stateRef.current.slideIndex) {
          setRemoteInk([]);
        }
      }
    });

    sync.onLaser((position) => {
      if (!isLeader) setRemoteLaser(position);
    });

    sync.onEphemeralInk((slideIndex, strokes) => {
      if (!isLeader) {
        setRemoteInkSlide(slideIndex);
        setRemoteInk(strokes);
      }
    });

    if (isLeader) {
      sync.onRequestState(() => {
        sync.publish(stateRef.current);
        sync.publishEphemeralInk(
          stateRef.current.slideIndex,
          ephemeralRef.current,
        );
      });
    } else {
      sync.requestState();
    }

    return () => sync.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [sessionId, isLeader]);

  useEffect(() => {
    if (isLeader) syncRef.current?.publish(state);
  }, [isLeader, state]);

  const prevSlideRef = useRef(state.slideIndex);
  useEffect(() => {
    if (!isLeader) return;
    if (prevSlideRef.current !== state.slideIndex) {
      setEphemeralStrokes([]);
      publishEphemeral(state.slideIndex, []);
    }
    prevSlideRef.current = state.slideIndex;
  }, [isLeader, state.slideIndex, publishEphemeral]);

  const clamp = useCallback(
    (n: number) => Math.min(pageCount, Math.max(1, n)),
    [pageCount],
  );

  const goTo = useCallback(
    (n: number) => publish({ slideIndex: clamp(n), blank: null }),
    [clamp, publish],
  );

  const handlers = useMemo(
    () => ({
      onNext: () =>
        publish({
          slideIndex: clamp(state.slideIndex + 1),
          blank: null,
        }),
      onPrev: () =>
        publish({
          slideIndex: clamp(state.slideIndex - 1),
          blank: null,
        }),
      onFirst: () => publish({ slideIndex: 1, blank: null }),
      onLast: () => publish({ slideIndex: pageCount, blank: null }),
      onBlank: (mode: PresentBlank) =>
        publish({ ...state, blank: state.blank === mode ? null : mode }),
      onToggleFullscreen: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      },
      onGoToSlide: () => {
        setGoToValue(String(state.slideIndex));
        setGoToOpen(true);
      },
      onShowHelp: () => setHelpOpen(true),
    }),
    [clamp, pageCount, publish, state],
  );

  usePresentKeyboard(handlers, true);

  const blankClass =
    state.blank === "black"
      ? "bg-black"
      : state.blank === "white"
        ? "bg-white"
        : "";

  const rehearsalStrokes = getRehearsalStrokes(state.slideIndex);
  const remoteEphemeral =
    !isLeader && remoteInkSlide === state.slideIndex ? remoteInk : [];
  const audienceInk = useMemo(
    () => [...rehearsalStrokes, ...remoteEphemeral],
    [rehearsalStrokes, remoteEphemeral],
  );
  const audienceLaser = !isLeader ? remoteLaser : null;

  const onLaserMove = useCallback(
    (position: LaserPosition) => {
      syncRef.current?.publishLaser(position);
    },
    [],
  );

  const presenterRehearsal = getRehearsalStrokes(state.slideIndex);
  const presenterDisplayStrokes = useMemo(
    () => [...presenterRehearsal, ...ephemeralStrokes],
    [presenterRehearsal, ephemeralStrokes],
  );

  const onPresenterStrokesChange = useCallback(
    (all: InkStroke[]) => {
      const ephemeral = all.slice(presenterRehearsal.length);
      setEphemeralStrokes(ephemeral);
      publishEphemeral(state.slideIndex, ephemeral);
    },
    [presenterRehearsal.length, publishEphemeral, state.slideIndex],
  );

  if (mode === "audience") {
    return (
      <div className={`fixed inset-0 flex flex-col ${blankClass || "bg-black"}`}>
        {state.blank ? null : (
          <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
            <SlideStage
              doc={doc}
              pageNumber={state.slideIndex}
              tool="none"
              strokes={audienceInk}
              laserPosition={audienceLaser}
            />
          </div>
        )}
        {!state.blank && (
          <p className="pointer-events-none absolute bottom-4 right-4 rounded bg-black/50 px-2 py-1 text-sm tabular-nums text-zinc-300">
            {state.slideIndex} / {pageCount}
          </p>
        )}
      </div>
    );
  }

  const nextIndex = clamp(state.slideIndex + 1);
  const speakerNote = getNote(state.slideIndex);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-500">
            Presenter
          </p>
          <h1 className="truncate text-sm font-medium">{fileName}</h1>
        </div>
        <p className="text-sm tabular-nums text-zinc-400">
          Slide {state.slideIndex} of {pageCount}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="text-xs text-zinc-500">Tools:</span>
        <ToolChip
          active={presentTool === "none"}
          onClick={() => setPresentTool("none")}
          label="Navigate"
        />
        <ToolChip
          active={presentTool === "laser"}
          onClick={() => setPresentTool("laser")}
          label="Laser"
        />
        <ToolChip
          active={presentTool === "pen"}
          onClick={() => setPresentTool("pen")}
          label="Pen (temp)"
        />
        <button
          type="button"
          onClick={() => {
            setEphemeralStrokes([]);
            publishEphemeral(state.slideIndex, []);
          }}
          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          Clear temp ink
        </button>
      </div>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-2">
        <section className="flex min-h-[240px] flex-col rounded-xl border border-zinc-800 bg-black">
          <p className="border-b border-zinc-800 px-3 py-1 text-xs text-zinc-500">
            Current (audience sees rehearsal ink + laser / temp ink)
          </p>
          <div className={`relative min-h-[200px] flex-1 ${state.blank ? blankClass : ""}`}>
            {state.blank ? null : (
              <SlideStage
                doc={doc}
                pageNumber={state.slideIndex}
                tool={presentTool}
                strokes={presenterDisplayStrokes}
                onStrokesChange={onPresenterStrokesChange}
                onLaserMove={onLaserMove}
                interactiveOverlay={
                  presentTool === "laser" || presentTool === "pen"
                }
              />
            )}
          </div>
        </section>

        <section className="flex min-h-[160px] flex-col rounded-xl border border-zinc-800 bg-zinc-900/50">
          <p className="border-b border-zinc-800 px-3 py-1 text-xs text-zinc-500">
            Next
          </p>
          <div className="relative min-h-[120px] flex-1 opacity-90">
            {nextIndex !== state.slideIndex ? (
              <SlideStage
                doc={doc}
                pageNumber={nextIndex}
                strokes={getRehearsalStrokes(nextIndex)}
              />
            ) : (
              <span className="flex h-full items-center justify-center text-sm text-zinc-500">
                End of deck
              </span>
            )}
          </div>
        </section>
      </div>

      <section
        className="mx-4 mb-2 rounded-xl border border-zinc-800 bg-zinc-900/50"
        aria-label="Speaker notes"
      >
        <p className="border-b border-zinc-800 px-3 py-1 text-xs text-zinc-500">
          Speaker notes — slide {state.slideIndex}
        </p>
        <div className="max-h-32 overflow-y-auto px-3 py-2 text-sm leading-relaxed text-zinc-200">
          {!notesReady ? (
            <span className="text-zinc-500">Loading notes…</span>
          ) : speakerNote.trim() ? (
            <p className="whitespace-pre-wrap">{speakerNote}</p>
          ) : (
            <p className="text-zinc-500">
              No notes for this slide. Add them in{" "}
              <a
                href={`/rehearse/${sessionId}`}
                className="text-emerald-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Rehearse
              </a>
              .
            </p>
          )}
        </div>
      </section>

      <footer className="flex flex-wrap gap-2 border-t border-zinc-800 px-4 py-3">
        <ToolButton onClick={handlers.onPrev} label="Previous" />
        <ToolButton onClick={handlers.onNext} label="Next" />
        <ToolButton onClick={() => handlers.onBlank("black")} label="Black" />
        <ToolButton onClick={() => handlers.onBlank("white")} label="White" />
        <ToolButton onClick={handlers.onToggleFullscreen} label="Fullscreen" />
        <ToolButton onClick={handlers.onGoToSlide} label="Go to…" />
        <ToolButton onClick={handlers.onShowHelp} label="?" />
      </footer>

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {goToOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="go-to-slide-title"
        >
          <form
            className="w-full max-w-xs rounded-xl border border-zinc-700 bg-zinc-900 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(goToValue, 10);
              if (!Number.isNaN(n)) goTo(n);
              setGoToOpen(false);
            }}
          >
            <p id="go-to-slide-title" className="text-sm font-medium text-zinc-200">
              Go to slide
            </p>
            <label className="mt-2 block text-sm text-zinc-300">
              <span className="sr-only">Slide number (1–{pageCount})</span>
              <input
                type="number"
                min={1}
                max={pageCount}
                autoFocus
                value={goToValue}
                onChange={(e) => setGoToValue(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg bg-zinc-800 py-2 text-sm"
                onClick={() => setGoToOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium"
              >
                Go
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
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

function ToolButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}
