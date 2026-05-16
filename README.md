# B1_2 — presentation tools monorepo

This repository hosts related web projects for presentation workflows.

| Folder | Product | Status |
|--------|---------|--------|
| [`ppt-auditor/`](./ppt-auditor/) | Deck compatibility auditor (`.pptx` preflight) | Archived / maintained for reference |
| [`pdf-presenter/`](./pdf-presenter/) | PDF deck presenter (rehearse + present) | **Active** — see [docs/PRD.md](./docs/PRD.md) |

## Active product

**PDF deck presenter** — open a PDF, add per-slide speaker notes and rehearsal ink, present with dual-window presenter/audience views, and export marked PDFs or notes JSON. Requirements: **[docs/PRD.md](./docs/PRD.md)**.

```bash
cd pdf-presenter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [`pdf-presenter/README.md`](./pdf-presenter/README.md).

## Archived: PPT auditor

The original `.pptx` static analyser lives in [`ppt-auditor/`](./ppt-auditor/). From that directory:

```bash
cd ppt-auditor
npm install
npm run dev
```

See [`ppt-auditor/README.md`](./ppt-auditor/README.md) for stack, tests, and reflection notes.

## Shared docs

- [`docs/PRD.md`](./docs/PRD.md) — PDF presenter product requirements (current)
- [`docs/AGENTS.md`](./docs/AGENTS.md) — agent / Next.js notes
- [`ppt-auditor/docs/`](./ppt-auditor/docs/) — original auditor PRD and brief

## Licence

MIT — see [LICENSE](./LICENSE).
