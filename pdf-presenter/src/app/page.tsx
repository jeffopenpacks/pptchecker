import { DeckOpenPanel } from "@/components/DeckOpenPanel";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
            PDF deck presenter
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
            Present PDFs like a slide deck
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Open a PDF in your browser, use presenter view on a second window, and
            navigate with keyboard shortcuts. Your file stays on this device.
          </p>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <DeckOpenPanel />
      </main>
    </div>
  );
}
