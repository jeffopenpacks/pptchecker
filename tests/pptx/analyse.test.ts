import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

import { analysePptx } from "@/lib/pptx/analyse";

function buildTinyPptx(options: {
  slideTypeface?: string;
  hugeMediaBytes?: number;
}): Uint8Array {
  const face = options.slideTypeface ?? "Arial";

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`;

  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openformats.org/presentationml/2006/main" xmlns:r="http://schemas.openformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
  </p:sldIdLst>
</p:presentation>`;

  const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openformats.org/presentationml/2006/main" xmlns:a="http://schemas.openformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r><a:rPr lang="en-US"><a:latin typeface="${face}"/></a:rPr><a:t>Hello</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "ppt/_rels/presentation.xml.rels": strToU8(presRels),
    "ppt/presentation.xml": strToU8(presentation),
    "ppt/slides/slide1.xml": strToU8(slide),
  };

  if (options.hugeMediaBytes && options.hugeMediaBytes > 0) {
    files["ppt/media/huge.bin"] = new Uint8Array(options.hugeMediaBytes).fill(7);
  }

  return zipSync(files, { level: 0 });
}

describe("analysePptx", () => {
  it("rejects non-zip input", () => {
    const r = analysePptx(strToU8("not a zip"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/zip/i);
  });

  it("parses minimal pptx and surfaces watchlist font", () => {
    const buf = buildTinyPptx({ slideTypeface: "Segoe UI" });
    const r = analysePptx(buf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.slideCount).toBeGreaterThanOrEqual(1);
    expect(r.stats.referencedFontFamilies.map((f) => f.toLowerCase())).toContain(
      "segoe ui",
    );
    const titles = r.findings.map((f) => f.title).join(" ");
    expect(titles).toMatch(/watchlist|Fonts referenced/i);
  });

  it("flags large ppt/media payload", () => {
    const buf = buildTinyPptx({
      slideTypeface: "Arial",
      hugeMediaBytes: 6 * 1024 * 1024,
    });
    const r = analysePptx(buf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.findings.some(
        (f) =>
          f.category === "media" &&
          f.title.toLowerCase().includes("large embedded media"),
      ),
    ).toBe(true);
  });
});
