# Deck compatibility auditor

A small web app that accepts a PowerPoint **`.pptx`** file and returns a **preflight report**: fonts, heavy media, and constructs that often behave differently across **macOS ↔ Windows** (or between export tools and PowerPoint). It is a **risk radar**, not a pixel-perfect guarantee.

- **Product requirements:** [docs/PRD.md](./docs/PRD.md)
- **Brief:** [docs/Brief.md](./docs/Brief.md)

## Repository layout

```
project/
├── README.md
├── LICENSE
├── .gitignore
├── package.json
├── requirements.txt      # placeholder — Python unused; see package.json
├── src/                    # Next.js app source (App Router, components, lib)
├── tests/                  # Vitest suites
├── docs/                   # PRD, brief, agent notes
├── scripts/                # automation / utilities (.gitkeep)
├── assets/                 # optional images, media (.gitkeep)
├── data/                   # optional datasets (.gitkeep)
└── public/                 # Next.js static assets (served from site root)
```

## Run locally

At the **repository root**:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload a `.pptx`, and review grouped findings.

```bash
npm test          # Vitest (minimal synthetic .pptx fixtures)
npm run build     # Production build
```

### Privacy (MVP)

Uploads are parsed **in memory** on the server inside the Route Handler; nothing is written to disk or a database by this codebase. On hosted platforms, check **request body size limits** (often stricter than the app’s 50&nbsp;MB cap).

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router), React |
| Language | TypeScript |
| `.pptx` unpack | `fflate` |
| XML | `fast-xml-parser` |
| Styling | Tailwind CSS |
| Tests | Vitest (`tests/`) |

**Analysis endpoint:** `POST /api/analyse` — implementation in `src/app/api/analyse/route.ts` (multipart upload → memory-only parse → JSON).

### Alternative architecture

Client-only analysis (`fflate` + `fast-xml-parser` in the browser) is possible if you need uploads to stay strictly on-device without a backend compliance review.

### Out of scope for MVP

Heavy native bindings (e.g. LibreOffice) and pixel rendering / headless PowerPoint — see [docs/PRD.md](./docs/PRD.md).

## Licence

See **[LICENSE](./LICENSE)** (MIT). Update the copyright line if you use a different legal name or organisation.
