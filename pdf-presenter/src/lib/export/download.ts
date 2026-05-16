export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): void {
  const copy = new Uint8Array(bytes);
  downloadBlob(new Blob([copy], { type: mimeType }), filename);
}

export function safeExportBasename(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").trim() || "deck";
  return base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120);
}
