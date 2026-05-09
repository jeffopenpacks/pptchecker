import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";

import {
  CROSS_PLATFORM_FONT_WATCHLIST,
  LARGE_IMAGE_DIMENSION,
  LARGE_MEDIA_BYTES,
  TOTAL_MEDIA_WARN_BYTES,
} from "./config";
import type {
  Category,
  DeckStats,
  Finding,
  AnalyseResult,
  Severity,
} from "./types";

const TYPEFACE_RE = /typeface="([^"]+)"/gi;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
});

function normalisePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function indexZip(entries: Record<string, Uint8Array>): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  for (const [raw, data] of Object.entries(entries)) {
    map.set(normalisePath(raw).toLowerCase(), data);
  }
  return map;
}

function decodeUtf8(data: Uint8Array): string {
  return strFromU8(data, false);
}

function slideIndexFromPath(path: string): number | undefined {
  const m = /ppt\/slides\/slide(\d+)\.xml$/i.exec(path);
  return m ? parseInt(m[1], 10) : undefined;
}

function extractTypefaces(xml: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(TYPEFACE_RE.source, TYPEFACE_RE.flags);
  while ((m = re.exec(xml)) !== null) {
    const name = m[1]?.trim();
    if (name) out.add(name);
  }
  return out;
}

function parseEmbeddedFontFamiliesFromPresentation(xml: string): Set<string> {
  const families = new Set<string>();
  try {
    const doc = xmlParser.parse(xml) as Record<string, unknown>;
    const pres = doc.presentation ?? doc;
    const lst = (pres as { embeddedFontLst?: unknown }).embeddedFontLst;
    if (!lst || typeof lst !== "object") return families;

    const embeddedFonts = (lst as { embeddedFont?: unknown }).embeddedFont;
    const arr = Array.isArray(embeddedFonts)
      ? embeddedFonts
      : embeddedFonts
        ? [embeddedFonts]
        : [];

    for (const ef of arr) {
      if (!ef || typeof ef !== "object") continue;
      const font = (ef as { font?: unknown }).font;
      const fontObjs = Array.isArray(font) ? font : font ? [font] : [];
      for (const f of fontObjs) {
        if (f && typeof f === "object") {
          const rec = f as Record<string, unknown>;
          const tf = rec["@_typeface"];
          if (typeof tf === "string" && tf.trim()) families.add(tf.trim());
        }
      }
    }
  } catch {
    const innerRe =
      /<p:font\b[^>]*typeface="([^"]+)"|<font\b[^>]*typeface="([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = innerRe.exec(xml)) !== null) {
      const name = (m[1] || m[2])?.trim();
      if (name) families.add(name);
    }
  }
  return families;
}

function parseRelationships(xml: string): Array<{
  type: string;
  target: string;
  targetMode?: string;
}> {
  const out: Array<{ type: string; target: string; targetMode?: string }> = [];
  try {
    const doc = xmlParser.parse(xml) as Record<string, unknown>;
    const relRoot = doc.Relationships;
    if (!relRoot || typeof relRoot !== "object") return out;
    const rel = (relRoot as { Relationship?: unknown }).Relationship;
    const arr = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const r of arr) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const type = rec["@_Type"];
      const target = rec["@_Target"];
      const targetMode = rec["@_TargetMode"];
      if (typeof type === "string" && typeof target === "string") {
        out.push({
          type,
          target,
          targetMode: typeof targetMode === "string" ? targetMode : undefined,
        });
      }
    }
  } catch {
    const blockRe =
      /<Relationship\b([^>]*)\/?>/gi;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(xml)) !== null) {
      const block = m[1] ?? "";
      const typ =
        /Type="([^"]+)"/i.exec(block)?.[1] ??
        /Type='([^']+)'/i.exec(block)?.[1];
      const tgt =
        /Target="([^"]+)"/i.exec(block)?.[1] ??
        /Target='([^']+)'/i.exec(block)?.[1];
      const tm =
        /TargetMode="([^"]+)"/i.exec(block)?.[1] ??
        /TargetMode='([^']+)'/i.exec(block)?.[1];
      if (typ && tgt) out.push({ type: typ, target: tgt, targetMode: tm });
    }
  }
  return out;
}

function countSlidesFromPresentationXml(xml: string): number {
  try {
    const doc = xmlParser.parse(xml) as Record<string, unknown>;
    const pres = doc.presentation ?? doc;
    const sldIdLst = (pres as { sldIdLst?: { sldId?: unknown } }).sldIdLst;
    if (!sldIdLst?.sldId) return 0;
    const ids = Array.isArray(sldIdLst.sldId)
      ? sldIdLst.sldId
      : [sldIdLst.sldId];
    return ids.length;
  } catch {
    const matches = xml.match(/<p:sldId\b/gi);
    return matches?.length ?? 0;
  }
}

function readPngDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  if (data.length < 24) return null;
  if (
    data[0] !== 0x89 ||
    data[1] !== 0x50 ||
    data[2] !== 0x4e ||
    data[3] !== 0x47
  ) {
    return null;
  }
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = dv.getUint32(16, false);
  const height = dv.getUint32(20, false);
  if (!width || !height) return null;
  return { width, height };
}

function looksLikeOleOrEmbedding(xml: string): boolean {
  return (
    /<a:oleObj\b/i.test(xml) ||
    /<p:oleObj\b/i.test(xml) ||
    /oleObject/i.test(xml) ||
    /<mc:AlternateContent[\s\S]*?oleObj/i.test(xml)
  );
}

function looksLikeAdvancedEffects(xml: string): boolean {
  return (
    /<a:outerShdw\b/i.test(xml) ||
    /<a:reflection\b/i.test(xml) ||
    /<a:blur\b/i.test(xml) ||
    /<a:sp3d\b/i.test(xml) ||
    /<a:scene3d\b/i.test(xml)
  );
}

function pushFinding(
  list: Finding[],
  severity: Severity,
  category: Category,
  title: string,
  description: string,
  remediation?: string,
  slideIndexes?: number[],
  part?: string,
) {
  list.push({
    severity,
    category,
    title,
    description,
    remediation,
    slideIndexes:
      slideIndexes?.length ? [...new Set(slideIndexes)].sort((a, b) => a - b) : undefined,
    part,
  });
}

export function analysePptx(buffer: Uint8Array): AnalyseResult {
  let files: Map<string, Uint8Array>;
  try {
    const raw = unzipSync(buffer);
    files = indexZip(raw as Record<string, Uint8Array>);
  } catch {
    return { ok: false, error: "This file is not a valid ZIP package (.pptx)." };
  }

  if (!files.has("[content_types].xml")) {
    return { ok: false, error: "Missing [Content_Types].xml — not a valid Office package." };
  }

  const presPath = "ppt/presentation.xml";
  const presData = files.get(presPath);
  if (!presData) {
    return { ok: false, error: "Missing ppt/presentation.xml — not a recognisable PowerPoint file." };
  }

  const presXml = decodeUtf8(presData);
  const slideCount = countSlidesFromPresentationXml(presXml);
  const embeddedFromPres = parseEmbeddedFontFamiliesFromPresentation(presXml);

  const fontsDirEntries = [...files.keys()].filter(
    (k) => k.startsWith("ppt/fonts/") && k.length > "ppt/fonts/".length,
  );
  const hasFontBinaries = fontsDirEntries.some(
    (k) =>
      k.endsWith(".fntdata") ||
      k.endsWith(".odttf") ||
      k.endsWith(".ttf") ||
      k.endsWith(".otf"),
  );

  const referencedFonts = new Set<string>();
  for (const [path, data] of files) {
    if (!path.endsWith(".xml")) continue;
    if (!path.startsWith("ppt/")) continue;
    if (path.includes("/tags/")) continue;
    const text = decodeUtf8(data);
    for (const f of extractTypefaces(text)) referencedFonts.add(f);
  }

  const embeddedLower = new Set(
    [...embeddedFromPres].map((f) => f.toLowerCase()),
  );

  const nonEmbedded = [...referencedFonts].filter(
    (f) => !embeddedLower.has(f.toLowerCase()),
  );

  const watchHits = [...referencedFonts].filter((f) =>
    CROSS_PLATFORM_FONT_WATCHLIST.has(f.toLowerCase()),
  );

  const findings: Finding[] = [];

  if (referencedFonts.size === 0) {
    pushFinding(
      findings,
      "info",
      "fonts",
      "No font families detected",
      "No DrawingML typeface attributes were found. The deck may use only theme defaults or non-text content.",
      "If text looks wrong on another machine, set explicit fonts and embed them in PowerPoint (File → Options → Save).",
    );
  } else if (nonEmbedded.length > 0) {
    const sample = nonEmbedded.slice(0, 12).join(", ");
    const extra =
      nonEmbedded.length > 12 ? ` (+${nonEmbedded.length - 12} more)` : "";
    const binaryHint =
      hasFontBinaries && embeddedFromPres.size === 0
        ? " Binary font payloads exist under ppt/fonts/, but names could not be matched to references."
        : "";
    pushFinding(
      findings,
      hasFontBinaries ? "info" : "warning",
      "fonts",
      hasFontBinaries && embeddedFromPres.size === 0
        ? "Fonts referenced; embedding partially opaque"
        : "Fonts referenced without embedded-font metadata",
      `These families may substitute on another OS if not installed: ${sample}.${extra}${binaryHint}`,
      "In PowerPoint: embed fonts on save, or align on a shared font stack across the team.",
    );
  } else {
    pushFinding(
      findings,
      "info",
      "fonts",
      embeddedFromPres.size > 0
        ? "Embedded font metadata present"
        : "Font references align with parsed embedding metadata",
      embeddedFromPres.size > 0
        ? "The presentation lists embedded fonts in presentation.xml. Substitution risk is lower but not eliminated."
        : hasFontBinaries
          ? "ppt/fonts/ contains payloads and referenced families appear covered by parsing."
          : "No unmatched font references detected by static analysis.",
      "Still verify on the target OS — embedding does not cover every edge case.",
    );
  }

  if (watchHits.length > 0) {
    pushFinding(
      findings,
      "warning",
      "fonts",
      "Cross-platform font watchlist",
      `These families often differ between macOS and Windows: ${watchHits.join(", ")}.`,
      "Prefer a shared font stack across the team or embed where PowerPoint allows.",
    );
  }

  const mediaPaths = [...files.keys()].filter((k) => k.startsWith("ppt/media/"));
  let totalMediaBytes = 0;
  const largeMedia: { path: string; bytes: number; dims?: string }[] = [];
  const largeDims: { path: string; dims: string }[] = [];

  for (const p of mediaPaths) {
    const data = files.get(p);
    if (!data) continue;
    totalMediaBytes += data.byteLength;
    const leaf = p.split("/").pop() ?? p;
    if (data.byteLength >= LARGE_MEDIA_BYTES) {
      largeMedia.push({
        path: leaf,
        bytes: data.byteLength,
      });
    }
    const dims =
      leaf.toLowerCase().endsWith(".png") ? readPngDimensions(data) : null;
    if (
      dims &&
      (dims.width >= LARGE_IMAGE_DIMENSION ||
        dims.height >= LARGE_IMAGE_DIMENSION)
    ) {
      const label = `${dims.width}×${dims.height}px`;
      largeDims.push({ path: leaf, dims: label });
      const idx = largeMedia.findIndex((x) => x.path === leaf);
      if (idx >= 0) largeMedia[idx]!.dims = label;
    }
  }

  if (largeMedia.length > 0) {
    const lines = largeMedia
      .slice(0, 8)
      .map(
        (m) =>
          `${m.path}: ${(m.bytes / (1024 * 1024)).toFixed(1)} MB${m.dims ? ` (${m.dims})` : ""}`,
      )
      .join("; ");
    const extra =
      largeMedia.length > 8 ? ` (+${largeMedia.length - 8} more)` : "";
    pushFinding(
      findings,
      "warning",
      "media",
      "Large embedded media",
      `${lines}${extra}`,
      "Compress images in PowerPoint (Picture Format → Compress) or shrink assets before inserting.",
    );
  }

  if (totalMediaBytes >= TOTAL_MEDIA_WARN_BYTES && mediaPaths.length > 0) {
    pushFinding(
      findings,
      "info",
      "media",
      "Heavy total media footprint",
      `All ppt/media parts together total ~${(totalMediaBytes / (1024 * 1024)).toFixed(1)} MB.`,
      "Large decks transfer slowly and some hosts recompress media differently.",
    );
  }

  if (largeDims.length > 0 && largeMedia.length === 0) {
    pushFinding(
      findings,
      "info",
      "media",
      "Very large image dimensions (PNG)",
      largeDims
        .slice(0, 6)
        .map((x) => `${x.path}: ${x.dims}`)
        .join("; ") +
        (largeDims.length > 6 ? ` (+${largeDims.length - 6} more)` : ""),
      "Huge pixel dimensions can increase memory use and export variance.",
    );
  }

  if (mediaPaths.length === 0) {
    pushFinding(
      findings,
      "info",
      "media",
      "No ppt/media parts",
      "No binary media parts were found in the package (unusual but valid).",
    );
  }

  const externalRels: { target: string; from: string }[] = [];
  const oleSlides: number[] = [];
  const hyperlinkExternal: string[] = [];
  const effectSlides: number[] = [];

  for (const [path, data] of files) {
    if (!path.endsWith(".rels")) continue;
    const xml = decodeUtf8(data);
    for (const r of parseRelationships(xml)) {
      const isExternal =
        (r.targetMode && r.targetMode.toLowerCase() === "external") ||
        /^https?:\/\//i.test(r.target);
      if (isExternal) {
        externalRels.push({ target: r.target, from: path });
      }
      if (
        r.type.toLowerCase().includes("hyperlink") &&
        /^https?:\/\//i.test(r.target)
      ) {
        hyperlinkExternal.push(r.target);
      }
      if (r.type.toLowerCase().includes("oleobject")) {
        const slide =
          /slides\/slide(\d+)\.xml\.rels$/i.exec(path)?.[1] ??
          /slide(\d+)\.xml\.rels$/i.exec(path)?.[1];
        if (slide) oleSlides.push(parseInt(slide, 10));
      }
    }
  }

  const embeddingPaths = [...files.keys()].filter((k) =>
    k.startsWith("ppt/embeddings/"),
  );
  if (embeddingPaths.length > 0) {
    pushFinding(
      findings,
      "high",
      "risk",
      "Embedded Office objects (ppt/embeddings)",
      `${embeddingPaths.length} embedding part(s). Excel/charts/objects here often behave differently across platforms.`,
      "Prefer native PowerPoint charts/tables or flatten critical sheets to static images if fidelity matters.",
      undefined,
      embeddingPaths.slice(0, 3).join(", "),
    );
  }

  const oleMarkupSlides: number[] = [];

  for (const [path, data] of files) {
    if (!/^ppt\/slides\/slide\d+\.xml$/i.test(path)) continue;
    const xml = decodeUtf8(data);
    const idx = slideIndexFromPath(path);
    if (looksLikeOleOrEmbedding(xml) && idx !== undefined) {
      oleMarkupSlides.push(idx);
      if (!oleSlides.includes(idx)) oleSlides.push(idx);
    }
    if (looksLikeAdvancedEffects(xml) && idx !== undefined) {
      effectSlides.push(idx);
    }
  }

  const oleSlideSet = [...new Set([...oleSlides, ...oleMarkupSlides])].sort(
    (a, b) => a - b,
  );

  if (embeddingPaths.length === 0 && oleSlideSet.length > 0) {
    pushFinding(
      findings,
      "high",
      "risk",
      "OLE / embedded object indicators",
      `Slides ${oleSlideSet.join(", ")} contain OLE-style markup or OLE relationships.`,
      "Verify linked workbooks and double-click behaviour on both macOS and Windows.",
      oleSlideSet,
    );
  }

  const uniqueHy = [...new Set(hyperlinkExternal)];
  if (uniqueHy.length > 0) {
    const sample = uniqueHy
      .slice(0, 5)
      .map((u) => `• ${u}`)
      .join("\n");
    pushFinding(
      findings,
      "info",
      "risk",
      "External hyperlinks",
      `${uniqueHy.length} HTTP(S) hyperlink(s). Targets must be reachable for everyone.\n${sample}${uniqueHy.length > 5 ? "\n• …" : ""}`,
      "Replace brittle intranet links with stable URLs or paste targets into speaker notes.",
    );
  }

  if (externalRels.length > 0) {
    const interesting = externalRels.filter(
      (x) =>
        !/^https?:\/\//i.test(x.target) &&
        !x.target.startsWith("file:"),
    );
    if (interesting.length > 0) {
      pushFinding(
        findings,
        "warning",
        "risk",
        "External package relationships",
        `${interesting.length} relationship(s) point outside the package (e.g. linked files).`,
        "Relative paths often break after moves; prefer embedding or cloud paths everyone can open.",
      );
    }
  }

  const uniqEffects = [...new Set(effectSlides)].sort((a, b) => a - b);
  if (uniqEffects.length > 0) {
    pushFinding(
      findings,
      "info",
      "risk",
      "Advanced drawing effects (heuristic)",
      `Shadows, blur, 3D, or similar markup detected on slide(s): ${uniqEffects.slice(0, 15).join(", ")}${uniqEffects.length > 15 ? "…" : ""}.`,
      "Effects do not always match pixel-perfect across GPU/OS combinations.",
      uniqEffects.slice(0, 15),
    );
  }

  pushFinding(
    findings,
    "info",
    "risk",
    "Heuristic-only cross-platform check",
    "This tool performs static analysis on the file package. It cannot simulate PowerPoint rendering on macOS vs Windows.",
    "Treat findings as a checklist before sharing editable decks.",
  );

  const stats: DeckStats = {
    slideCount,
    fontsReferenced: referencedFonts.size,
    fontsEmbedded: embeddedFromPres.size,
    embeddedFontFamilies: [...embeddedFromPres],
    referencedFontFamilies: [...referencedFonts].sort((a, b) =>
      a.localeCompare(b),
    ),
    mediaFileCount: mediaPaths.length,
    totalMediaBytes,
  };

  findings.sort((a, b) => {
    const sev = { high: 0, warning: 1, info: 2 };
    const cat = { fonts: 0, media: 1, risk: 2 };
    return sev[a.severity] - sev[b.severity] || cat[a.category] - cat[b.category];
  });

  return { ok: true, findings, stats };
}
