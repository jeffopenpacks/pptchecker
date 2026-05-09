"use client";

import { useCallback, useId, useState } from "react";

import { MAX_UPLOAD_BYTES } from "@/lib/pptx/config";
import type { AnalyseResult, Finding } from "@/lib/pptx/types";

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

const severityLabel: Record<string, string> = {
  high: "High risk",
  warning: "Warning",
  info: "Info",
};

function severityStyles(sev: Finding["severity"]) {
  switch (sev) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-100";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/80 dark:bg-amber-950/35 dark:text-amber-50";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100";
  }
}

function groupByCategory(findings: Finding[]) {
  const m: Record<string, Finding[]> = { fonts: [], media: [], risk: [] };
  for (const f of findings) {
    m[f.category]?.push(f);
  }
  return m;
}

export function DeckAuditor() {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyseResult | null>(null);

  const analyse = useCallback(async (file: File) => {
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith(".pptx")) {
      setError("Choose a .pptx file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/analyse", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as AnalyseResult;
      if (!res.ok && (!data || typeof data !== "object")) {
        setError("Unexpected server response.");
        return;
      }
      if (!data.ok) {
        setError("error" in data ? data.error : "Analysis failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void analyse(f);
      e.target.value = "";
    },
    [analyse],
  );

  const grouped =
    result?.ok === true ? groupByCategory(result.findings) : null;

  return (
    <div className="space-y-10">
      <section
        aria-labelledby={`${inputId}-heading`}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <h2
          id={`${inputId}-heading`}
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Upload a deck
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Send a <strong className="font-medium text-zinc-800 dark:text-zinc-200">.pptx</strong>{" "}
          only (max {MAX_MB}&nbsp;MB). Files are analysed in memory on the server and{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">not stored</strong>.
        </p>

        <div
          className="mt-4 max-w-xl rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300"
          role="note"
        >
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Export source:
          </span>{" "}
          Most trustworthy results come from decks{" "}
          <strong className="font-medium text-zinc-900 dark:text-zinc-50">
            built or finalised in Microsoft PowerPoint or Google Slides
          </strong>{" "}
          (save or download as{" "}
          <strong className="font-medium text-zinc-900 dark:text-zinc-50">.pptx</strong>
          ). Tools such as{" "}
          <strong className="font-medium text-zinc-900 dark:text-zinc-50">Canva</strong>{" "}
          often emit markup that diverges from typical PowerPoint OOXML, so font and
          compatibility hints here may be incomplete — when it matters, round-trip once through
          PowerPoint or Slides before uploading.
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {busy ? "Analysing…" : "Choose .pptx"}
            <input
              id={inputId}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="sr-only"
              disabled={busy}
              onChange={onInput}
            />
          </label>
          <span className="text-xs text-zinc-500 dark:text-zinc-500">
            Risk hints only — not a pixel-perfect guarantee.
          </span>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </section>

      {result?.ok === true ? (
        <>
          <section
            aria-label="Deck statistics"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <StatCard label="Slides (reported)" value={String(result.stats.slideCount)} />
            <StatCard
              label="Font families referenced"
              value={String(result.stats.fontsReferenced)}
            />
            <StatCard
              label="Embedded font entries"
              value={String(result.stats.fontsEmbedded)}
            />
            <StatCard
              label="Media footprint"
              value={`${(result.stats.totalMediaBytes / (1024 * 1024)).toFixed(1)} MB`}
              hint={
                result.stats.avgMediaBytesPerSlide != null
                  ? `${result.stats.mediaFileCount} file(s) · ~${(result.stats.avgMediaBytesPerSlide / (1024 * 1024)).toFixed(2)} MB/slide avg`
                  : `${result.stats.mediaFileCount} file(s)`
              }
            />
          </section>

          <section aria-label="Findings" className="space-y-8">
            <CategoryBlock
              title="Typography"
              subtitle="Substitution and embedding hints"
              findings={grouped?.fonts ?? []}
            />
            <CategoryBlock
              title="Media weight"
              subtitle="Large assets and total package media"
              findings={grouped?.media ?? []}
            />
            <CategoryBlock
              title="Cross-platform fragility"
              subtitle="OLE, links, effects — heuristic signals"
              findings={grouped?.risk ?? []}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {props.value}
      </p>
      {props.hint ? (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">{props.hint}</p>
      ) : null}
    </div>
  );
}

function CategoryBlock(props: {
  title: string;
  subtitle: string;
  findings: Finding[];
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {props.title}
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{props.subtitle}</p>
      <ul className="mt-4 space-y-3">
        {props.findings.map((f, i) => (
          <li
            key={`${f.title}-${i}`}
            className={`rounded-xl border px-4 py-3 text-sm ${severityStyles(f.severity)}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="sr-only">{severityLabel[f.severity]}</span>
              <span className="font-semibold" aria-hidden="true">
                [{f.severity}]
              </span>
              <span className="font-semibold">{f.title}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed opacity-95">
              {f.description}
            </p>
            {f.remediation ? (
              <p className="mt-2 border-t border-black/10 pt-2 text-xs opacity-90 dark:border-white/10">
                <span className="font-medium">Tip:</span> {f.remediation}
              </p>
            ) : null}
            {(f.slideIndexes?.length || f.part) ? (
              <p className="mt-2 text-xs opacity-80">
                {f.slideIndexes?.length ? (
                  <span>Slides: {f.slideIndexes.join(", ")}. </span>
                ) : null}
                {f.part ? <span>Part: {f.part}</span> : null}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
