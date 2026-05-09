import { strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

import {
  CROSS_PLATFORM_FONT_WATCHLIST,
  MEDIA_PER_SLIDE_HEAVY_MAX_BYTES,
  MEDIA_PER_SLIDE_MODERATE_MAX_BYTES,
  MEDIA_PER_SLIDE_TYPICAL_MAX_BYTES,
  MAX_RELS_PARTS_TO_ANALYSE,
  MAX_SLIDE_PARTS_TO_ANALYSE,
  MAX_XML_CHARS_SCAN_PER_PART,
  MAX_XML_PARTS_TO_SCAN,
} from "./config";
import { unzipOpcLimited } from "./unzip-opc";
import type {
  Category,
  DeckStats,
  Finding,
  AnalyseResult,
  Severity,
} from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  /** Skip XML declarations; reduces odd-ball declaration handling on untrusted input. */
  ignoreDeclaration: true,
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

function sliceForXmlScan(xml: string): string {
  if (xml.length <= MAX_XML_CHARS_SCAN_PER_PART) return xml;
  return xml.slice(0, MAX_XML_CHARS_SCAN_PER_PART);
}

function getSortedSlideXmlPaths(files: Map<string, Uint8Array>): string[] {
  const paths = [...files.keys()].filter((k) =>
    /^ppt\/slides\/slide\d+\.xml$/i.test(k),
  );
  paths.sort(
    (a, b) =>
      (slideIndexFromPath(a) ?? 0) - (slideIndexFromPath(b) ?? 0),
  );
  return paths;
}

function slideIndexFromPath(path: string): number | undefined {
  const m = /ppt\/slides\/slide(\d+)\.xml$/i.exec(path);
  return m ? parseInt(m[1], 10) : undefined;
}

function slideNumFromSlideRelsPath(relPath: string): number | undefined {
  const m = /ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/i.exec(relPath);
  return m ? parseInt(m[1], 10) : undefined;
}

function slidePartPath(slideNum: number): string {
  return `ppt/slides/slide${slideNum}.xml`;
}

/** Resolve OPC relationship Target relative to the source part path (e.g. ppt/slides/slide1.xml). */
function resolveOpcTarget(sourcePartPath: string, target: string): string {
  const norm = target.replace(/\\/g, "/").trim();
  if (!norm) return "";
  if (norm.startsWith("/")) {
    return normalisePath(norm.slice(1)).toLowerCase();
  }
  const dirIdx = sourcePartPath.lastIndexOf("/");
  const dir =
    dirIdx >= 0 ? sourcePartPath.slice(0, dirIdx) : "";
  const segments = dir.split("/").filter(Boolean);
  for (const seg of norm.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") segments.pop();
    else segments.push(seg);
  }
  return segments.join("/").toLowerCase();
}

const MAX_SLIDES_INLINE = 28;

function formatSlideNumbers(slides: number[]): string {
  const u = [...new Set(slides)].sort((a, b) => a - b);
  if (u.length === 0) return "";
  if (u.length <= MAX_SLIDES_INLINE) return u.join(", ");
  const head = u.slice(0, MAX_SLIDES_INLINE).join(", ");
  return `${head} (+${u.length - MAX_SLIDES_INLINE} more)`;
}

/** DrawingML / WordprocessingML font tokens before theme placeholder resolution. */
function collectRawFontTokens(chunk: string): string[] {
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  const patterns = [
    /\btypeface="([^"]+)"/gi,
    /\btypeface='([^']+)'/gi,
    /\bw:ascii="([^"]+)"/gi,
    /\bw:hAnsi="([^"]+)"/gi,
    /\bw:eastAsia="([^"]+)"/gi,
  ];
  for (const re of patterns) {
    while ((m = re.exec(chunk)) !== null) {
      const name = m[1]?.trim();
      if (name) tokens.push(name);
    }
  }
  return tokens;
}

function latinEaCsFromFontBlock(block: string): {
  lt?: string;
  ea?: string;
  cs?: string;
} {
  const lt =
    /<(?:a:)?latin\b[^>]*\btypeface="([^"]*)"/i.exec(block)?.[1]?.trim() ??
    /<(?:a:)?latin\b[^>]*\btypeface='([^']*)'/i.exec(block)?.[1]?.trim();
  const ea =
    /<(?:a:)?ea\b[^>]*\btypeface="([^"]*)"/i.exec(block)?.[1]?.trim() ??
    /<(?:a:)?ea\b[^>]*\btypeface='([^']*)'/i.exec(block)?.[1]?.trim();
  const cs =
    /<(?:a:)?cs\b[^>]*\btypeface="([^"]*)"/i.exec(block)?.[1]?.trim() ??
    /<(?:a:)?cs\b[^>]*\btypeface='([^']*)'/i.exec(block)?.[1]?.trim();
  return {
    lt: lt || undefined,
    ea: ea || undefined,
    cs: cs || undefined,
  };
}

/**
 * Map OOXML theme placeholders (+mj-lt, +mn-lt, …) to fontScheme families from ppt/theme/theme*.xml.
 * Canva / exports often put placeholders on slides while the real name lives in the theme.
 */
function buildThemeFontAliasMap(files: Map<string, Uint8Array>): Map<string, string> {
  const map = new Map<string, string>();
  const themePaths = [...files.keys()]
    .filter((k) => /^ppt\/theme\/theme\d+\.xml$/i.test(k))
    .sort();

  function record(alias: string, face: string | undefined) {
    const f = face?.trim();
    if (f) map.set(alias.toLowerCase(), f);
  }

  for (const p of themePaths) {
    const data = files.get(p);
    if (!data) continue;
    const xml = sliceForXmlScan(decodeUtf8(data));
    const major = /<(?:a:)?majorFont\b[^>]*>([\s\S]*?)<\/(?:a:)?majorFont>/i.exec(
      xml,
    )?.[1];
    const minor = /<(?:a:)?minorFont\b[^>]*>([\s\S]*?)<\/(?:a:)?minorFont>/i.exec(
      xml,
    )?.[1];

    const mj = latinEaCsFromFontBlock(major ?? "");
    const mn = latinEaCsFromFontBlock(minor ?? "");

    record("+mj-lt", mj.lt);
    record("+mj-ea", mj.ea);
    record("+mj-cs", mj.cs);
    record("+mn-lt", mn.lt);
    record("+mn-ea", mn.ea);
    record("+mn-cs", mn.cs);
  }

  return map;
}

function resolveThemeFontToken(
  raw: string,
  aliases: Map<string, string>,
): string {
  const t = raw.trim();
  if (!t) return "";
  const resolved = aliases.get(t.toLowerCase())?.trim();
  return resolved && resolved.length > 0 ? resolved : t;
}

/** Font families referenced in XML after expanding theme placeholders (e.g. +mn-lt → MaryKate). */
function extractResolvedFontFamilies(
  xml: string,
  themeAliases: Map<string, string>,
): Set<string> {
  const chunk = sliceForXmlScan(xml);
  const out = new Set<string>();
  for (const raw of collectRawFontTokens(chunk)) {
    const name = resolveThemeFontToken(raw, themeAliases);
    if (name) out.add(name);
  }
  return out;
}

function parseEmbeddedFontFamiliesFromPresentation(xml: string): Set<string> {
  const families = new Set<string>();
  const xmlSlice = sliceForXmlScan(xml);
  try {
    const doc = xmlParser.parse(xmlSlice) as Record<string, unknown>;
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
    while ((m = innerRe.exec(xmlSlice)) !== null) {
      const name = (m[1] || m[2])?.trim();
      if (name) families.add(name);
    }
  }
  return families;
}

function parseRelationships(xml: string): Array<{
  id?: string;
  type: string;
  target: string;
  targetMode?: string;
}> {
  const xmlSlice = sliceForXmlScan(xml);
  const out: Array<{
    id?: string;
    type: string;
    target: string;
    targetMode?: string;
  }> = [];
  try {
    const doc = xmlParser.parse(xmlSlice) as Record<string, unknown>;
    const relRoot = doc.Relationships;
    if (!relRoot || typeof relRoot !== "object") return out;
    const rel = (relRoot as { Relationship?: unknown }).Relationship;
    const arr = Array.isArray(rel) ? rel : rel ? [rel] : [];
    for (const r of arr) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const idRaw = rec["@_Id"];
      const type = rec["@_Type"];
      const target = rec["@_Target"];
      const targetMode = rec["@_TargetMode"];
      if (typeof type === "string" && typeof target === "string") {
        out.push({
          id: typeof idRaw === "string" ? idRaw : undefined,
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
    while ((m = blockRe.exec(xmlSlice)) !== null) {
      const block = m[1] ?? "";
      const id =
        /\bId="([^"]+)"/i.exec(block)?.[1] ??
        /\bId='([^']+)'/i.exec(block)?.[1];
      const typ =
        /Type="([^"]+)"/i.exec(block)?.[1] ??
        /Type='([^']+)'/i.exec(block)?.[1];
      const tgt =
        /Target="([^"]+)"/i.exec(block)?.[1] ??
        /Target='([^']+)'/i.exec(block)?.[1];
      const tm =
        /TargetMode="([^"]+)"/i.exec(block)?.[1] ??
        /TargetMode='([^']+)'/i.exec(block)?.[1];
      if (typ && tgt) out.push({ id, type: typ, target: tgt, targetMode: tm });
    }
  }
  return out;
}

/** Lowercase font name -> slide indexes where it appears in slide parts only. */
function buildFontToSlidesFromSlides(
  files: Map<string, Uint8Array>,
  slideXmlPathsToScan: string[],
  themeAliases: Map<string, string>,
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const path of slideXmlPathsToScan) {
    const data = files.get(path);
    if (!data) continue;
    const slideNum = slideIndexFromPath(path);
    if (slideNum === undefined) continue;
    const text = sliceForXmlScan(decodeUtf8(data));
    for (const f of extractResolvedFontFamilies(text, themeAliases)) {
      const key = f.toLowerCase();
      let set = map.get(key);
      if (!set) {
        set = new Set<number>();
        map.set(key, set);
      }
      set.add(slideNum);
    }
  }
  return map;
}

function countSlidesFromPresentationXml(xml: string): number {
  const xmlSlice = sliceForXmlScan(xml);
  try {
    const doc = xmlParser.parse(xmlSlice) as Record<string, unknown>;
    const pres = doc.presentation ?? doc;
    const sldIdLst = (pres as { sldIdLst?: { sldId?: unknown } }).sldIdLst;
    if (!sldIdLst?.sldId) return 0;
    const ids = Array.isArray(sldIdLst.sldId)
      ? sldIdLst.sldId
      : [sldIdLst.sldId];
    return ids.length;
  } catch {
    const matches = xmlSlice.match(/<p:sldId\b/gi);
    return matches?.length ?? 0;
  }
}

function looksLikeOleOrEmbedding(xml: string): boolean {
  const s = sliceForXmlScan(xml);
  return (
    /<a:oleObj\b/i.test(s) ||
    /<p:oleObj\b/i.test(s) ||
    /oleObject/i.test(s) ||
    /<mc:AlternateContent[\s\S]*?oleObj/i.test(s)
  );
}

function looksLikeAdvancedEffects(xml: string): boolean {
  const s = sliceForXmlScan(xml);
  return (
    /<a:outerShdw\b/i.test(s) ||
    /<a:reflection\b/i.test(s) ||
    /<a:blur\b/i.test(s) ||
    /<a:sp3d\b/i.test(s) ||
    /<a:scene3d\b/i.test(s)
  );
}

function describeEmbeddedMediaVsSlides(
  totalMediaBytes: number,
  slideCount: number,
): {
  severity: Severity;
  title: string;
  description: string;
  remediation: string;
} {
  const divisor = Math.max(slideCount, 1);
  const avgBytesPerSlide = totalMediaBytes / divisor;
  const totalMb = (totalMediaBytes / (1024 * 1024)).toFixed(2);
  const avgMb = (avgBytesPerSlide / (1024 * 1024)).toFixed(2);
  const slideLabel =
    slideCount > 0 ? `${slideCount}` : "unknown (÷1 used for average)";

  const header =
    `ppt/media totals ~${totalMb} MB across ${slideLabel} reported slide(s) (~${avgMb} MB per slide on average).`;

  let severity: Severity = "info";
  let title = "Embedded media density";
  let body: string;
  let remediation: string;

  if (avgBytesPerSlide <= MEDIA_PER_SLIDE_TYPICAL_MAX_BYTES) {
    title = "Light embedded media per slide";
    body =
      "That sits in a light band typical of text-led decks with modest or sparse imagery.";
    remediation =
      "Little to do unless you still hit email or upload ceilings elsewhere.";
  } else if (avgBytesPerSlide <= MEDIA_PER_SLIDE_MODERATE_MAX_BYTES) {
    title = "Moderate embedded media per slide";
    body =
      "That matches many mixed decks (charts, moderate photos, branded backgrounds).";
    remediation =
      "Compress images if handoff size becomes awkward.";
  } else if (avgBytesPerSlide <= MEDIA_PER_SLIDE_HEAVY_MAX_BYTES) {
    severity = "warning";
    title = "Heavy embedded media per slide";
    body =
      "That is higher than most text-first decks — often large photos, full-bleed backgrounds, or video poster frames.";
    remediation =
      "Use Picture Format → Compress Pictures, or shrink assets before inserting.";
  } else {
    severity = "warning";
    title = "Very heavy embedded media per slide";
    body =
      "That is unusually high per slide unless almost every slide is full-bleed imagery or similar.";
    remediation =
      "Aggressively compress or replace assets; check duplicates across layouts and masters.";
  }

  const tail =
    slideCount === 0
      ? "\n\nSlide count was not read from presentation.xml; the average assumes one slide — reopen in PowerPoint and re-save if this looks wrong."
      : "";

  return {
    severity,
    title,
    description: `${header}\n\n${body}${tail}`,
    remediation,
  };
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
  const unpacked = unzipOpcLimited(buffer);
  if (!unpacked.ok) {
    return { ok: false, error: unpacked.error };
  }
  const files = indexZip(unpacked.files);

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

  const themeFontAliases = buildThemeFontAliasMap(files);

  const referencedFonts = new Set<string>();
  const pptXmlParts = [...files.keys()]
    .filter(
      (k) =>
        k.endsWith(".xml") &&
        k.startsWith("ppt/") &&
        !k.includes("/tags/"),
    )
    .sort();
  let xmlPartsSeen = 0;
  for (const path of pptXmlParts) {
    if (xmlPartsSeen >= MAX_XML_PARTS_TO_SCAN) break;
    xmlPartsSeen++;
    const data = files.get(path);
    if (!data) continue;
    const text = sliceForXmlScan(decodeUtf8(data));
    for (const f of extractResolvedFontFamilies(text, themeFontAliases)) {
      referencedFonts.add(f);
    }
  }

  const embeddedLower = new Set(
    [...embeddedFromPres].map((f) => f.toLowerCase()),
  );

  const allSlideXmlPaths = getSortedSlideXmlPaths(files);
  const cappedSlideXmlPaths = allSlideXmlPaths.slice(
    0,
    MAX_SLIDE_PARTS_TO_ANALYSE,
  );
  const slideScanTruncated =
    allSlideXmlPaths.length > cappedSlideXmlPaths.length;

  const fontToSlides = buildFontToSlidesFromSlides(
    files,
    cappedSlideXmlPaths,
    themeFontAliases,
  );

  /** Substitution warnings apply only to fonts that appear on slide XML — not themes/masters alone. */
  const nonEmbeddedOnSlides = [...referencedFonts].filter(
    (f) =>
      fontToSlides.has(f.toLowerCase()) &&
      !embeddedLower.has(f.toLowerCase()),
  );

  const watchHitsOnSlides = [...referencedFonts].filter(
    (f) =>
      fontToSlides.has(f.toLowerCase()) &&
      CROSS_PLATFORM_FONT_WATCHLIST.has(f.toLowerCase()),
  );

  const findings: Finding[] = [];

  if (slideScanTruncated) {
    pushFinding(
      findings,
      "info",
      "risk",
      "Slide scan limit reached",
      `Only the first ${MAX_SLIDE_PARTS_TO_ANALYSE} slides were analysed in depth (fonts, OLE/effects heuristics). This deck reports ${allSlideXmlPaths.length} slide part(s).`,
      "Split very large decks or raise limits in configuration if you control the deployment.",
    );
  }

  if (referencedFonts.size === 0) {
    pushFinding(
      findings,
      "info",
      "fonts",
      "No font families detected",
      "No DrawingML typeface attributes were found. The deck may use only theme defaults or non-text content.",
      "If text looks wrong on another machine, set explicit fonts and embed them in PowerPoint (File → Options → Save).",
    );
  } else if (nonEmbeddedOnSlides.length > 0) {
    const fontLines = nonEmbeddedOnSlides.slice(0, 18).map((fn) => {
      const slides = [...(fontToSlides.get(fn.toLowerCase()) ?? [])].sort(
        (a, b) => a - b,
      );
      const slideTxt = ` — slides ${formatSlideNumbers(slides)}`;
      return `• ${fn}${slideTxt}`;
    });
    const fontOverflow =
      nonEmbeddedOnSlides.length > 18
        ? `\n… (+${nonEmbeddedOnSlides.length - 18} more families)`
        : "";
    const binaryHint =
      hasFontBinaries && embeddedFromPres.size === 0
        ? "\n\nBinary font payloads exist under ppt/fonts/, but names could not be matched to references."
        : "";
    const slideUnion = new Set<number>();
    for (const fn of nonEmbeddedOnSlides) {
      const set = fontToSlides.get(fn.toLowerCase());
      if (set) for (const n of set) slideUnion.add(n);
    }
    pushFinding(
      findings,
      hasFontBinaries ? "info" : "warning",
      "fonts",
      hasFontBinaries && embeddedFromPres.size === 0
        ? "Fonts on slides; embedding partially opaque"
        : "Slide text uses fonts without embedded-font metadata",
      `These families appear on slide parts and may substitute on another OS if not installed:\n${fontLines.join("\n")}${fontOverflow}${binaryHint}`,
      "In PowerPoint: embed fonts on save, or align on a shared font stack across the team.",
      [...slideUnion].sort((a, b) => a - b),
    );
  } else if (fontToSlides.size === 0 && referencedFonts.size > 0) {
    pushFinding(
      findings,
      "info",
      "fonts",
      "Font metadata only outside slide parts",
      "Typefaces were found in themes, layouts, or other package parts, but not as explicit references on the scanned slide XML. Slide text may still inherit those fonts in PowerPoint — we do not flag them here.",
      "Open the deck on the target OS if inheritance might still cause drift.",
    );
  } else {
    pushFinding(
      findings,
      "info",
      "fonts",
      embeddedFromPres.size > 0
        ? "Embedded font metadata present"
        : "Slide font references align with parsed embedding metadata",
      embeddedFromPres.size > 0
        ? "The presentation lists embedded fonts in presentation.xml. Substitution risk is lower but not eliminated."
        : hasFontBinaries
          ? "ppt/fonts/ contains payloads and slide-level references appear covered by parsing."
          : "No non-embedded slide-level font references detected.",
      "Still verify on the target OS — embedding does not cover every edge case.",
    );
  }

  if (watchHitsOnSlides.length > 0) {
    const lines = watchHitsOnSlides.map((fn) => {
      const slides = [...(fontToSlides.get(fn.toLowerCase()) ?? [])].sort(
        (a, b) => a - b,
      );
      const slideTxt = ` — slides ${formatSlideNumbers(slides)}`;
      return `• ${fn}${slideTxt}`;
    });
    const watchSlides = new Set<number>();
    for (const fn of watchHitsOnSlides) {
      const set = fontToSlides.get(fn.toLowerCase());
      if (set) for (const n of set) watchSlides.add(n);
    }
    pushFinding(
      findings,
      "warning",
      "fonts",
      "Cross-platform font watchlist (on slides)",
      `These families often differ between macOS and Windows:\n${lines.join("\n")}`,
      "Prefer a shared font stack across the team or embed where PowerPoint allows.",
      [...watchSlides].sort((a, b) => a - b),
    );
  }

  const mediaPaths = [...files.keys()].filter((k) => k.startsWith("ppt/media/"));
  let totalMediaBytes = 0;

  for (const p of mediaPaths) {
    const data = files.get(p);
    if (!data) continue;
    totalMediaBytes += data.byteLength;
  }

  if (mediaPaths.length > 0) {
    const mediaInsight = describeEmbeddedMediaVsSlides(
      totalMediaBytes,
      slideCount,
    );
    pushFinding(
      findings,
      mediaInsight.severity,
      "media",
      mediaInsight.title,
      mediaInsight.description,
      mediaInsight.remediation,
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

  const externalRels: {
    target: string;
    from: string;
    slideNum?: number;
  }[] = [];
  const oleSlides: number[] = [];
  const hyperlinkExternal: string[] = [];
  const hyperlinkSlides = new Set<number>();
  const embeddingRefSlides = new Set<number>();
  const effectSlides: number[] = [];

  const relPathsSorted = [...files.keys()]
    .filter((k) => k.endsWith(".rels"))
    .sort();
  let relsSeen = 0;

  for (const path of relPathsSorted) {
    if (relsSeen >= MAX_RELS_PARTS_TO_ANALYSE) break;
    relsSeen++;
    const data = files.get(path);
    if (!data) continue;
    const xml = decodeUtf8(data);
    const slideFromRels = slideNumFromSlideRelsPath(path);
    const partPath =
      slideFromRels !== undefined ? slidePartPath(slideFromRels) : "";

    for (const r of parseRelationships(xml)) {
      if (slideFromRels !== undefined && partPath) {
        const resolved = resolveOpcTarget(partPath, r.target);
        if (resolved.startsWith("ppt/embeddings/")) {
          embeddingRefSlides.add(slideFromRels);
        }
      }

      const isExternal =
        (r.targetMode && r.targetMode.toLowerCase() === "external") ||
        /^https?:\/\//i.test(r.target);
      if (isExternal) {
        externalRels.push({
          target: r.target,
          from: path,
          slideNum: slideFromRels,
        });
      }
      if (
        r.type.toLowerCase().includes("hyperlink") &&
        /^https?:\/\//i.test(r.target)
      ) {
        hyperlinkExternal.push(r.target);
        if (slideFromRels !== undefined) hyperlinkSlides.add(slideFromRels);
      }
      if (r.type.toLowerCase().includes("oleobject")) {
        if (slideFromRels !== undefined) {
          oleSlides.push(slideFromRels);
        } else {
          const slide =
            /slides\/slide(\d+)\.xml\.rels$/i.exec(path)?.[1] ??
            /slide(\d+)\.xml\.rels$/i.exec(path)?.[1];
          if (slide) oleSlides.push(parseInt(slide, 10));
        }
      }
    }
  }

  const embeddingPaths = [...files.keys()].filter((k) =>
    k.startsWith("ppt/embeddings/"),
  );
  if (embeddingPaths.length > 0) {
    const slideIdx =
      embeddingRefSlides.size > 0
        ? [...embeddingRefSlides].sort((a, b) => a - b)
        : undefined;
    pushFinding(
      findings,
      "high",
      "risk",
      "Embedded Office objects (ppt/embeddings)",
      `${embeddingPaths.length} embedding part(s). Excel/charts/objects here often behave differently across platforms.${slideIdx?.length ? ` Referenced from slides: ${formatSlideNumbers(slideIdx)}.` : ""}`,
      "Prefer native PowerPoint charts/tables or flatten critical sheets to static images if fidelity matters.",
      slideIdx,
      embeddingPaths.slice(0, 3).join(", "),
    );
  }

  const oleMarkupSlides: number[] = [];

  for (const path of cappedSlideXmlPaths) {
    const data = files.get(path);
    if (!data) continue;
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
    const hySlideIdx = hyperlinkSlides.size
      ? [...hyperlinkSlides].sort((a, b) => a - b)
      : undefined;
    pushFinding(
      findings,
      "info",
      "risk",
      "External hyperlinks",
      `${uniqueHy.length} HTTP(S) hyperlink(s). Targets must be reachable for everyone.${hySlideIdx?.length ? ` Slides with link relationships: ${formatSlideNumbers(hySlideIdx)}.` : ""}\n${sample}${uniqueHy.length > 5 ? "\n• …" : ""}`,
      "Replace brittle intranet links with stable URLs or paste targets into speaker notes.",
      hySlideIdx,
    );
  }

  if (externalRels.length > 0) {
    const interesting = externalRels.filter(
      (x) =>
        !/^https?:\/\//i.test(x.target) &&
        !x.target.startsWith("file:"),
    );
    if (interesting.length > 0) {
      const extSlideNums = new Set<number>();
      for (const x of interesting) {
        if (x.slideNum !== undefined) extSlideNums.add(x.slideNum);
      }
      const extSlideIdx = extSlideNums.size
        ? [...extSlideNums].sort((a, b) => a - b)
        : undefined;
      pushFinding(
        findings,
        "warning",
        "risk",
        "External package relationships",
        `${interesting.length} relationship(s) point outside the package (e.g. linked files).${extSlideIdx?.length ? ` Slides: ${formatSlideNumbers(extSlideIdx)}.` : ""}`,
        "Relative paths often break after moves; prefer embedding or cloud paths everyone can open.",
        extSlideIdx,
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
    avgMediaBytesPerSlide:
      mediaPaths.length === 0
        ? null
        : totalMediaBytes / Math.max(slideCount, 1),
  };

  findings.sort((a, b) => {
    const sev = { high: 0, warning: 1, info: 2 };
    const cat = { fonts: 0, media: 1, risk: 2 };
    return sev[a.severity] - sev[b.severity] || cat[a.category] - cat[b.category];
  });

  return { ok: true, findings, stats };
}
