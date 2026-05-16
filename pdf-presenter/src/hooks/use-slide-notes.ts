"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  broadcastNotesUpdated,
  notesChannelName,
} from "@/lib/notes-sync";
import { applyNoteText, limitMessage } from "@/lib/notes-limits";
import { loadSessionNotes, saveSessionNotes } from "@/lib/notes-store";

const SAVE_DEBOUNCE_MS = 400;

export function useSlideNotes(sessionId: string) {
  const [bySlide, setBySlide] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const bySlideRef = useRef<string[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void loadSessionNotes(sessionId).then((notes) => {
      if (cancelled) return;
      bySlideRef.current = notes.bySlide;
      setBySlide(notes.bySlide);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const persist = useCallback(() => {
    void saveSessionNotes({
      sessionId,
      bySlide: bySlideRef.current,
    }).then(() => broadcastNotesUpdated(sessionId));
  }, [sessionId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  useEffect(() => {
    const ch = new BroadcastChannel(notesChannelName(sessionId));
    ch.onmessage = () => {
      void loadSessionNotes(sessionId).then((notes) => {
        bySlideRef.current = notes.bySlide;
        setBySlide(notes.bySlide);
      });
    };
    return () => {
      ch.close();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        persist();
      }
    };
  }, [sessionId, persist]);

  const getNote = useCallback(
    (slideIndex: number) => bySlide[slideIndex - 1] ?? "",
    [bySlide],
  );

  const setNote = useCallback(
    (slideIndex: number, text: string) => {
      const { bySlide: next, limitReason } = applyNoteText(
        bySlideRef.current,
        slideIndex,
        text,
      );
      bySlideRef.current = next;
      setBySlide(next);
      setLimitWarning(limitMessage(limitReason));
      scheduleSave();
    },
    [scheduleSave],
  );

  const reload = useCallback(() => {
    void loadSessionNotes(sessionId).then((notes) => {
      bySlideRef.current = notes.bySlide;
      setBySlide(notes.bySlide);
    });
  }, [sessionId]);

  return { ready, getNote, setNote, flushSave: persist, reload, limitWarning };
}
