import { unzipSync } from "fflate";

import {
  MAX_UNZIPPED_TOTAL_BYTES,
  MAX_ZIP_CENTRAL_ENTRIES,
  MAX_ZIP_DECLARED_UNCOMPRESSED_TOTAL_BYTES,
  MAX_ZIP_ENTRY_PATH_LENGTH,
  MAX_ZIP_SINGLE_ENTRY_UNCOMPRESSED_BYTES,
} from "./config";

export type UnzipOpcResult =
  | { ok: true; files: Record<string, Uint8Array> }
  | { ok: false; error: string };

function looksLikeZipSignature(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function isSafeMemberPath(name: string): boolean {
  const n = name.replace(/\\/g, "/").trim();
  if (!n || n.length > MAX_ZIP_ENTRY_PATH_LENGTH) return false;
  if (n.startsWith("/")) return false;
  const segments = n.split("/");
  for (const seg of segments) {
    if (seg === "..") return false;
  }
  return true;
}

/**
 * Bounded synchronous unzip for OPC packages (.pptx). Filters entries before inflate,
 * then verifies aggregate extracted bytes (declared sizes can lie only within inflated buffer bounds).
 */
export function unzipOpcLimited(buffer: Uint8Array): UnzipOpcResult {
  if (!looksLikeZipSignature(buffer)) {
    return {
      ok: false,
      error:
        "This does not look like a ZIP-based Office file (missing PK signature).",
    };
  }

  let seenCentralEntries = 0;
  let declaredAcceptedSum = 0;

  try {
    const raw = unzipSync(buffer, {
      filter(entry) {
        seenCentralEntries++;
        if (seenCentralEntries > MAX_ZIP_CENTRAL_ENTRIES) return false;
        if (!isSafeMemberPath(entry.name)) return false;

        const declared = Number(entry.originalSize);
        if (!Number.isFinite(declared) || declared < 0) return false;
        if (declared > MAX_ZIP_SINGLE_ENTRY_UNCOMPRESSED_BYTES) return false;
        if (
          declaredAcceptedSum + declared >
          MAX_ZIP_DECLARED_UNCOMPRESSED_TOTAL_BYTES
        ) {
          return false;
        }

        declaredAcceptedSum += declared;
        return true;
      },
    }) as Record<string, Uint8Array>;

    let actualTotal = 0;
    for (const v of Object.values(raw)) {
      actualTotal += v.byteLength;
    }
    if (actualTotal > MAX_UNZIPPED_TOTAL_BYTES) {
      return {
        ok: false,
        error:
          "Unpacked archive exceeds the maximum allowed size (possible ZIP compression bomb).",
      };
    }

    return { ok: true, files: raw };
  } catch {
    return { ok: false, error: "This file is not a valid ZIP package (.pptx)." };
  }
}
