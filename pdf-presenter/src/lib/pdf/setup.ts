let configured = false;

export async function ensurePdfWorker(): Promise<void> {
  if (configured || typeof window === "undefined") return;
  const { GlobalWorkerOptions } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  configured = true;
}
