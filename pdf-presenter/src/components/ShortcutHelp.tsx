"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ROWS: [string, string][] = [
  ["→ / Space / PgDn", "Next slide"],
  ["← / PgUp", "Previous slide"],
  ["Home / End", "First / last slide"],
  ["G", "Go to slide"],
  ["B / W", "Black / white screen"],
  ["F", "Fullscreen"],
  ["?", "This help"],
  ["Esc", "Exit fullscreen"],
];

export function ShortcutHelp({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-50">Keyboard shortcuts</h2>
        <dl className="mt-4 space-y-2 text-sm">
          {ROWS.map(([key, action]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="font-mono text-emerald-400">{key}</dt>
              <dd className="text-zinc-300">{action}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-zinc-800 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
