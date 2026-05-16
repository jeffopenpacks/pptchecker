"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  error: string | null;
  busy: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export function PasswordDialog({
  open,
  error,
  busy,
  onSubmit,
  onCancel,
}: Props) {
  const titleId = useId();
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <form
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(password);
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-zinc-50">
          This PDF is password-protected
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Enter the password to open it. Your password stays in this browser and
          is not sent to a server.
        </p>
        <label className="mt-4 block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="off"
          />
        </label>
        {error ? (
          <p className="mt-2 text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Opening…" : "Open"}
          </button>
        </div>
      </form>
    </div>
  );
}
