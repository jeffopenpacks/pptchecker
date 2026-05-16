/** PDF.js asset URLs (copied to /public by postinstall). */
export function pdfDocumentInitOptions(
  data: ArrayBuffer,
  password?: string,
): {
  data: ArrayBuffer;
  password: string;
  useSystemFonts: boolean;
  standardFontDataUrl: string;
  wasmUrl: string;
} {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const base = origin.replace(/\/$/, "");

  return {
    data: data.slice(0),
    password: password ?? "",
    useSystemFonts: true,
    standardFontDataUrl: `${base}/standard_fonts/`,
    wasmUrl: `${base}/wasm/`,
  };
}
