# Product requirements document — Deck compatibility auditor

## 1. Summary

A small web application that accepts a PowerPoint file (`.pptx`) and produces a **static compatibility report**: areas that **may** shift, break, or behave differently when the deck is opened or edited on another operating system (chiefly macOS ↔ Windows) or handed between tools (e.g. Canva export → PowerPoint).

The product does **not** promise identical pixels or layout; it surfaces **risk** so authors can fix issues before handoff.

## 2. Problem statement

Teams routinely create presentations in Canva or PowerPoint and share editable source files. Fonts, heavy media, and certain object types often cause **layout drift or broken behaviour** across platforms. PDF preserves appearance but removes editability, which is unacceptable for this workflow.

## 3. Goals

| Goal | Detail |
|------|--------|
| **Actionable hints** | Users see grouped findings with plain-language explanations and, where useful, remediation hints (e.g. embed fonts, replace linked media). |
| **Honest scope** | Positioning is “risk radar”, not “guaranteed match everywhere”. |
| **Simple UX** | Upload → analyse → report; minimal chrome suitable for a portfolio/demo. |

## 4. Non-goals (MVP)

- Rendering slides or pixel-by-pixel comparison between platforms.
- Fixing or rewriting decks automatically (report-only unless explicitly added later).
- Native Canva project format or Apple Keynote as inputs (PPTX only for MVP).
- Accounts, billing, or multi-tenant admin.
- PDF export as a substitute workflow for end users (out of scope for *their* process; optional “download summary” may be a later nice-to-have).

## 5. Target user

Primary: **presentation authors** (yourself and colleagues) who exchange editable `.pptx` files across Mac and Windows and want a quick **preflight check** before sharing.

Secondary: **reviewers** judging a portfolio piece built with an agentic workflow — clarity of scope and technical judgement matter.

## 6. User stories

1. As an author, I upload a `.pptx` and see whether **fonts** are likely to substitute or are missing embedding so I can align with team standards.
2. As an author, I see **large or heavy media** so I can compress or replace assets before email/cloud handoff.
3. As an author, I see **platform-fragile constructs** (e.g. embedded spreadsheets, external links, advanced effects) so I know where to simplify or check manually on the other OS.

## 7. Functional requirements

### 7.1 Input & validation

- Accept **`.pptx`** only (Office Open XML package).
- Reject non-ZIP/corrupt files with a clear error.
- Enforce a **maximum upload size** (configurable constant; document default e.g. 25–50 MB for MVP).

### 7.2 Analysis categories

**Fonts**

- Enumerate font families referenced via slide content, layouts, masters, and themes (DrawingML / theme chains as implemented).
- Detect presence of **embedded font** payloads under the standard OPC paths where applicable.
- Flag: fonts used **without** embedding (informational vs warning severity — product decision: default warning for non-embedded body fonts).
- Optional MVP+: maintain a short **heuristic list** of families commonly problematic cross-platform; flag as “review recommended”.

**Large images / heavy media**

- List media parts under `ppt/media/` (and related relationship targets).
- Flag files above configurable thresholds (defaults TBD): per-file size (e.g. > 5 MB) and optionally total media footprint.
- Optional MVP+: read image headers for dimensions and flag very large dimensions.

**Platform-specific / fragile formatting**

- Flag **external** relationships (`TargetMode="External"`) and hyperlinks to non-package URLs where identifiable.
- Flag **OLE / embedded Office objects** (or equivalent package indicators) as high-risk for cross-platform behaviour.
- Flag presence of **advanced drawing effects** at a coarse level (e.g. blur, 3D, reflection) if parsing allows without deep layout simulation — severity capped as “may differ”.
- Do **not** claim exhaustive detection; label category as **heuristic**.

### 7.3 Output

- Structured report: **severity** (e.g. info / warning / high), **category**, **title**, **description**, **remediation hint**.
- Where possible: **slide index** or **part path** for traceability (best-effort; missing slide context is acceptable with “deck-wide” scope).

### 7.4 Privacy & data handling (MVP default)

- Process uploads **server-side** or **in-browser only** — architecture decision during implementation; document chosen approach in README.
- If server-side: **do not persist** file contents after analysis completes (ephemeral storage only); state retention policy in README.

## 8. Non-functional requirements

- **Performance**: Typical decks (< ~50 slides, < size limit) complete analysis within a few seconds on modest hardware.
- **Reliability**: Malformed or unusual OOXML should fail gracefully with a user-visible message, not an opaque 500.
- **Accessibility**: Report readable without colour-only cues (icons + text).

## 9. Success criteria (MVP)

- Demonstrably runs on **real** sample decks (including at least one plain corporate deck and one export-from-design-tool style deck).
- Three pillars visibly covered in UI: **Fonts**, **Media weight**, **Cross-platform risk**.
- Copy consistently avoids promising pixel-perfect parity.

## 10. Milestones (suggested for agentic build)

1. **Parse & inventory** — Unzip OPC; list parts; smoke tests on sample files.
2. **Font pass** — References + embedding detection.
3. **Media pass** — Sizes (+ optional dimensions).
4. **Risk pass** — External links, OLE/embed indicators, coarse effects.
5. **UI & API** — Upload, progress, report grouping and empty states.

## 11. Open questions

- Server-side vs WASM/client-only analysis (trade-off: simplicity vs zero-upload privacy story).
- Exact default thresholds for “large” media.
- Whether to ship v1 without slide-level attribution for every finding.

## 12. Document control

| Version | Date | Notes |
|---------|------|--------|
| 0.1 | 2026-05-09 | Initial MVP PRD from discovery |
