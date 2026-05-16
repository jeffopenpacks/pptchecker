# PDF Presenter

Browser app to **present PDF slide decks** with keyboard navigation, dual-window **presenter + audience** views, and optional password-protected PDFs. Files stay on your device (IndexedDB).

Requirements: [../docs/PRD.md](../docs/PRD.md)

## Run locally

```bash
cd pdf-presenter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

## Usage

1. Drop or choose a PDF (max **100 MB**; warning from **50 MB**).
2. Enter a password if prompted.
3. From the session hub, open **presenter** and **audience** windows (or audience only in one tab).
4. Control slides from the presenter window; use **?** for shortcuts.

## MVP scope

**M1 — Present:** PDF render, navigation, fullscreen, black/white screen, dual-window sync, password prompt.

**M2 — Rehearse & notes:** Per-slide speaker notes (saved in IndexedDB), rehearse mode, notes panel in presenter view. Notes capped at **4,000** characters per slide and **200,000** total per deck.

**M3 — Ink & laser:** Laser pointer and temporary pen in present mode (synced to audience; clears on slide change). Pen and highlighter in rehearse mode with overlays persisted in IndexedDB and shown in Present (audience + presenter).

**M4 — Export & polish:** Download original PDF, flattened PDF (rehearsal ink burned in), or speaker notes JSON from the session hub. Skip link, focus styles, and dialog accessibility improvements.
