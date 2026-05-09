import { DeckAuditor } from "@/components/DeckAuditor";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90 px-6 py-10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Deck compatibility auditor
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Preflight editable PowerPoint decks
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Upload a <strong className="font-medium text-zinc-800 dark:text-zinc-200">.pptx</strong>{" "}
            for a static risk report: fonts that may substitute, heavy media, and constructs that
            often diverge between macOS and Windows. This is a checklist — not a promise of
            identical pixels everywhere.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <DeckAuditor />
      </main>

      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        Static analysis on the Open Packaging Convention zip — no slide rendering.
      </footer>
    </div>
  );
}
