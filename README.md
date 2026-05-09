# Deck compatibility auditor

A small web app that accepts a PowerPoint **`.pptx`** file and returns a **preflight report**: fonts, heavy media, and constructs that often behave differently across **macOS ↔ Windows** (or between export tools and PowerPoint). It is a **risk radar**, not a pixel-perfect guarantee.

Full requirements: **[PRD.md](./PRD.md)** · Project note: **[Brief.md](./Brief.md)** · App: **`web/`**

## Status

The Next.js application lives in **`web/`** (upload UI + `POST /api/analyse`). Run locally from that folder.

### Run locally

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload a `.pptx`, and review grouped findings.

```bash
cd web
npm test          # Vitest (minimal synthetic .pptx fixtures)
npm run build     # Production build
```

### Privacy (MVP)

Uploads are parsed **in memory** on the server inside the Route Handler; nothing is written to disk or a database by this codebase. On hosted platforms, check their **request body size limits** (often stricter than the app’s 50&nbsp;MB cap).

## Implemented tech stack (`web/`)

The app uses the stack proposed below (Next.js + `fflate` + `fast-xml-parser` + Vitest).

### Recommended: **Next.js (App Router) + TypeScript**

| Layer | Choice | Rationale |
|-------|--------|-------------|
| **Framework** | [Next.js](https://nextjs.org/) (App Router) | One repo for UI + API routes; simple deploy story for a portfolio demo. |
| **Language** | TypeScript | Safer OOXML traversal and shared types between analyser and UI. |
| **Unpack `.pptx`** | [`fflate`](https://github.com/101arrowz/fflate) or [`jszip`](https://stuk.github.io/jszip/) | `.pptx` is a ZIP of XML/parts; these run well in Node (Route Handlers / Server Actions). |
| **XML** | [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) | Fast, configurable namespaces for DrawingML / OPC relationship XML. |
| **UI** | React + [Tailwind CSS](https://tailwindcss.com/) | Quick, readable layout for upload + grouped findings. Optional [shadcn/ui](https://ui.shadcn.com/) for accessible primitives. |
| **Testing** | [Vitest](https://vitest.dev/) | Fast unit tests for parsers against tiny fixture `.pptx` blobs checked into `fixtures/`. |
| **Hosting** | [Vercel](https://vercel.com/) (or any Node host) | Matches Next.js; set sensible body size limits for uploads. |

**Processing model:** analysis runs **on the server** in `web/src/app/api/analyse/route.ts` (multipart upload → memory-only parse → JSON report).

### Alternative: **client-only (privacy-first)**

- **Vite + React + TypeScript**, **`fflate`** + **`fast-xml-parser`** entirely in the browser: file never leaves the device; deploy as static assets (e.g. Cloudflare Pages, GitHub Pages).

Trade-off: larger JS bundle and CPU on the client; upside is a strong story for sensitive decks without backend compliance work.

### What to avoid for MVP

- **Heavy native bindings** (e.g. LibreOffice) — operational cost and deployment friction for a small demo.
- **Pixel rendering / headless PowerPoint** — out of scope per PRD.

## Licence

See **[LICENSE](./LICENSE)** (MIT). Update the copyright line if you use a different legal name or organisation.
