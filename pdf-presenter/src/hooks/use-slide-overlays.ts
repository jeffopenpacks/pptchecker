"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_STROKES_PER_SLIDE } from "@/lib/config";
import type { InkStroke } from "@/lib/overlay-types";
import {
  broadcastOverlaysUpdated,
  overlaysChannelName,
} from "@/lib/overlay-sync";
import {
  loadSessionOverlays,
  saveSessionOverlays,
} from "@/lib/overlay-store";

const SAVE_DEBOUNCE_MS = 400;

export function useSlideOverlays(sessionId: string) {
  const [bySlide, setBySlide] = useState<InkStroke[][]>([]);
  const [ready, setReady] = useState(false);
  const bySlideRef = useRef<InkStroke[][]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    void loadSessionOverlays(sessionId).then((data) => {
      bySlideRef.current = data.bySlide;
      setBySlide(data.bySlide);
      setReady(true);
    });
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void loadSessionOverlays(sessionId).then((data) => {
      if (cancelled) return;
      bySlideRef.current = data.bySlide;
      setBySlide(data.bySlide);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(overlaysChannelName(sessionId));
      ch.onmessage = () => reload();
    } catch {
      /* BroadcastChannel unavailable */
    }
    return () => ch?.close();
  }, [sessionId, reload]);

  const persist = useCallback(() => {
    void saveSessionOverlays({
      sessionId,
      bySlide: bySlideRef.current,
    }).then(() => broadcastOverlaysUpdated(sessionId));
  }, [sessionId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        persist();
      }
    },
    [persist],
  );

  const getStrokes = useCallback(
    (slideIndex: number) => bySlide[slideIndex - 1] ?? [],
    [bySlide],
  );

  const setStrokes = useCallback(
    (slideIndex: number, strokes: InkStroke[]) => {
      const capped = strokes.slice(0, MAX_STROKES_PER_SLIDE);
      setBySlide((prev) => {
        const next = [...prev];
        while (next.length < slideIndex) next.push([]);
        next[slideIndex - 1] = capped;
        bySlideRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  return { ready, getStrokes, setStrokes };
}
