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
    files["ppt/slides/_rels/slide1.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openformats.org/package/2006/relationships">
  <Relationship Id="rId10" Type="http://schemas.openformats.org/officeDocument/2006/relationships/image" Target="../media/huge.bin"/>
</Relationships>`);
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
    const watch = r.findings.find((f) =>
      f.title.toLowerCase().includes("watchlist"),
    );
    expect(watch?.slideIndexes).toEqual([1]);
  });

  it("classifies heavy average media (total ÷ slide count)", () => {
    const buf = buildTinyPptx({
      slideTypeface: "Arial",
      hugeMediaBytes: 6 * 1024 * 1024,
    });
    const r = analysePptx(buf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.avgMediaBytesPerSlide).toBe(6 * 1024 * 1024);
    const density = r.findings.find(
      (f) => f.category === "media" && f.title.includes("Heavy embedded"),
    );
    expect(density?.severity).toBe("warning");
  });

  it("classifies light average media when embed is small per slide", () => {
    const buf = buildTinyPptx({
      slideTypeface: "Arial",
      hugeMediaBytes: 120 * 1024,
    });
    const r = analysePptx(buf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.avgMediaBytesPerSlide).toBe(120 * 1024);
    const density = r.findings.find(
      (f) => f.category === "media" && f.title.includes("Light embedded"),
    );
    expect(density?.severity).toBe("info");
  });

  it("resolves +mn-lt theme placeholder to the minor latin face (export-style)", () => {
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`;
    const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:fontScheme name="Test">
      <a:majorFont><a:latin typeface="Arial"/></a:majorFont>
      <a:minorFont><a:latin typeface="Marykate"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;
    const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openformats.org/presentationml/2006/main" xmlns:a="http://schemas.openformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p>
    <a:r><a:rPr><a:latin typeface="+mn-lt"/></a:rPr><a:t>Hi</a:t></a:r>
  </a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`;
    const buf = zipSync(
      {
        "[Content_Types].xml": strToU8(ct),
        "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`),
        "ppt/_rels/presentation.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`),
        "ppt/presentation.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openformats.org/presentationml/2006/main" xmlns:r="http://schemas.openformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
</p:presentation>`),
        "ppt/slides/slide1.xml": strToU8(slide),
        "ppt/theme/theme1.xml": strToU8(theme),
      },
      { level: 0 },
    );
    const r = analysePptx(buf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.stats.referencedFontFamilies.map((f) => f.toLowerCase()),
    ).toContain("marykate");
  });
});
