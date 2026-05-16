"use client";

import { useEffect } from "react";

import type { PresentBlank } from "@/lib/types";

type Handlers = {
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onBlank: (mode: PresentBlank) => void;
  onToggleFullscreen: () => void;
  onGoToSlide: () => void;
  onShowHelp: () => void;
};

export function usePresentKeyboard(handlers: Handlers, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault();
          handlers.onNext();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          handlers.onPrev();
          break;
        case "Home":
          e.preventDefault();
          handlers.onFirst();
          break;
        case "End":
          e.preventDefault();
          handlers.onLast();
          break;
        case "b":
        case "B":
          e.preventDefault();
          handlers.onBlank("black");
          break;
        case "w":
        case "W":
          e.preventDefault();
          handlers.onBlank("white");
          break;
        case "f":
        case "F":
          e.preventDefault();
          handlers.onToggleFullscreen();
          break;
        case "g":
        case "G":
          e.preventDefault();
          handlers.onGoToSlide();
          break;
        case "?":
          e.preventDefault();
          handlers.onShowHelp();
          break;
        case "Escape":
          if (document.fullscreenElement) {
            e.preventDefault();
            void document.exitFullscreen();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handlers]);
}
