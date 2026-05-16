# Product requirements document — PDF deck presenter

| Field | Value |
|-------|--------|
| **Working title** | PDF deck presenter (repo folder TBD, e.g. `pdf-presenter/`) |
| **Status** | Draft — greenfield product |
| **Version** | 0.3 |
| **Date** | 2026-05-16 |

## 1. Summary

A browser-based web application for **rehearsing and presenting PDF slide decks** with a **presenter-first** experience: fullscreen slide navigation, optional **per-slide notes**, **presenter view** (current + next slide + notes), and **annotation tools** tuned for the room—not a general-purpose PDF editor.

The product targets staff who **receive or export final decks as PDF** (from PowerPoint, Google Slides, Canva, etc.) and need a **consistent, install-free** way to present on heterogeneous machines (macOS, Windows, locked-down room PCs).

It deliberately does **not** try to replace Adobe Acrobat for document review, legal redaction, or full PDF annotation spec compliance in v1.

## 2. Problem statement

### Who is affected

Management and operations staff who present frequently, often on **personal or mixed devices**, without a uniform corporate device stack.

### What goes wrong today

- **Cross-platform `.pptx`** causes font and layout surprises; many teams **export to PDF** for the actual meeting—but then rely on **Preview, Chrome, or Adobe Reader**, each with different fullscreen, shortcuts, and annotation behaviour.
- **Adobe Reader fullscreen** can simulate a slideshow but is a **generic PDF tool**: dense UI, no presenter view for PDF, no slide-scoped rehearsal notes, and annotations are built for document review—not “I’m on stage in five minutes.”
- **Design-tool exports** (e.g. Canva) push teams toward PDF as the handoff format anyway; there is no lightweight internal tool shaped for **that** workflow.

### Desired outcome

One bookmarkable web app: open PDF → rehearse with notes and private markup → present fullscreen with predictable keyboard controls and optional live ink—**without uploading the deck to a server** in the default privacy model.

## 3. Product positioning

| We are | We are not |
|--------|------------|
| “PowerPoint presenter experience, file is PDF” | A `.pptx` compatibility auditor (see `ppt-auditor/` in this repo) |
| Presenter + rehearsal focused | A replacement for Acrobat Pro feature-for-feature |
| Client-side processing by default | A deck authoring or Canva/PPT converter |

### Competitive note

Adobe Reader already offers fullscreen and rich PDF annotations. Differentiation is **workflow and UX**, not “we can show PDF pages”:

- Presenter view (audience slide + next slide + notes)
- **Rehearse vs Present** modes (e.g. persistent rehearsal ink vs ephemeral live ink)
- Slide-indexed notes stored by the app
- Minimal chrome, PowerPoint-like shortcuts (arrows, B/W screen, jump-to-slide)
- Optional org deck library (post-MVP)

## 4. Goals

| Goal | Detail |
|------|--------|
| **Reliable presenting** | Fullscreen, fit-to-viewport, clear slide counter, keyboard navigation. |
| **Rehearsal support** | Per-slide notes and private markup before the meeting. |
| **Room-ready tools** | Laser pointer and/or temporary ink that does not clutter the exported file unless the user chooses. |
| **Privacy story** | v1 processes PDF **in the browser**; no server upload required for core flows. |
| **Honest scope** | Do not claim pixel parity with every PDF producer; support common slide-sized PDFs. |

## 5. Non-goals

### MVP

- Editing slide **content** (text/images) inside the PDF.
- Converting `.pptx` / Google Slides / Canva → PDF.
- Real-time multi-user collaboration or comments threading.
- Accounts, billing, enterprise SSO (unless later phase explicitly adds).
- Full **ISO PDF annotation** round-trip guaranteed in every PDF reader (Phase 3; see §7.3).
- AI features, analytics dashboards, or pixel simulation across OSes.

### Long-term (explicitly out unless reprioritised)

- Native mobile apps (responsive web first).
- Video embed sync, slide transitions, or animation (PDF is static pages).

## 6. Target users

| Persona | Need |
|---------|------|
| **Presenter** | Open deck, present fullscreen, jump slides, black screen, optional live pointer/ink. |
| **Presenter (prep)** | Add per-slide notes and rehearsal marks before the room. |
| **Reviewer / comms** (secondary) | Hand off a PDF + optional annotated export for others. |

## 7. User stories

### Presenting

1. As a presenter, I open a PDF and enter **fullscreen slide mode** with one slide per page and **← / →** navigation so I can run the meeting without Acrobat UI.
2. As a presenter, I see **slide N of M** and can **jump to a slide number** from the keyboard.
3. As a presenter, I can press **B** or **W** to show a black or white screen without leaving the session.
4. As a presenter, I can use a **laser pointer** or **temporary ink** that clears when I change slides or exit Present mode (configurable).

### Rehearsing

5. As a presenter, I add **notes per slide** that appear in presenter view but not on the audience display.
6. As a presenter, I draw **rehearsal markup** (pen/highlighter) that is saved in the app for my next session on the same device (local storage) without requiring server upload.

### Handoff (post-MVP / Phase 2+)

7. As a presenter, I **export a PDF** that includes my annotations for colleagues who use Reader.
8. As a team lead, I open a **shared deck** from an internal list (hosted phase).

### Encrypted PDFs

9. As a presenter, when I open a **password-protected PDF**, I am prompted for the password so I can rehearse and present without leaving the browser.

## 8. Functional requirements

### 8.1 Input & validation

- Accept **`.pdf`** via file picker and drag-and-drop.
- Reject non-PDF or unreadable files with a clear message.
- Enforce a **maximum file size of 100 MB** (hard cap at open; reject larger files before loading into memory). See §8.1.1.
- Show a **soft warning** at **50 MB** (“Large file — opening may take a moment on older devices”) but allow proceed.

#### 8.1.1 File size limit (100 MB) — decision & browser reality

**Decision:** **100 MB** is the MVP cap. It is conservative for typical slide decks (most exports are &lt; 30 MB) and avoids treating the tab like a bulk file host.

**Can browsers handle 100 MB PDFs?** **Often yes, with caveats:**

| Factor | Notes |
|--------|--------|
| **Loading** | The full file is read into an `ArrayBuffer` in RAM. A 100 MB PDF can mean **~100 MB+ peak memory** during parse, plus decoded page bitmaps (much larger per page while rendering). |
| **Typical decks** | 20–40 slides exported from PowerPoint/Google, mostly vector + compressed images, are usually **5–40 MB** — browsers handle these comfortably. |
| **Heavy decks** | Image-only or 4K-heavy PDFs at 80–100 MB may **open slowly** or stress **8 GB RAM** laptops; use soft warning + one-page-at-a-time rendering (§8.3). |
| **Hard failures** | Mobile Safari / low-memory tabs may kill the page before 100 MB; desktop Chrome/Edge/Firefox are the primary target. |
| **Not a browser “upload limit”** | Client-only flow has **no server body limit**; the cap is **our** guardrail for UX and memory, not a platform maximum. |

**Implementation:** Check `file.size` before `arrayBuffer()`; constant `MAX_PDF_BYTES = 100 * 1024 * 1024` in app config. Tune later only if real decks routinely hit the cap with valid use cases.
- Support PDFs where **one page ≈ one slide** (typical export). Multi-page layouts are shown as-is; no automatic slide splitting in v1.
- Support **password-protected** PDFs via an on-open prompt (see §8.8).

### 8.2 Modes

| Mode | Purpose |
|------|---------|
| **Library / open** | Select or drop PDF; show metadata (page count, file name, approximate size). |
| **Rehearse** | Edit per-slide notes; persistent private annotation layer; optional thumbnail strip. |
| **Present** | Fullscreen audience view; ephemeral tools; optional second-window **presenter view**. |

Mode transitions must not lose unsaved notes (prompt or auto-save to `localStorage` / IndexedDB).

### 8.3 Slide rendering & navigation

- Render pages with **PDF.js** (or equivalent); scale to fit viewport (letterbox); optional “fill width” toggle later.
- Navigation: previous/next, first/last, go-to-page dialog or number keys.
- Preload **current ± 1** page for responsiveness on large decks.
- **Fullscreen API** for audience display; respect browser security (user gesture to enter).

### 8.4 Presenter view (MVP — dual window)

**Decision:** MVP includes **dual-window presenter view**, not only split-screen on one monitor.

**How it works**

- The presenter opens the deck once, then launches **Presenter view** (e.g. “Open presenter window”).
- The app opens a **second window** (same browser, same origin) — e.g. `/present/audience` and `/present/presenter`, or equivalent routes.
- **Audience window:** current slide only, fullscreen-friendly, minimal UI.
- **Presenter window:** current slide (smaller), **next slide** preview, **speaker notes**, optional timer (v1.1).
- Both windows stay in sync (slide index, black/white screen) via **`BroadcastChannel`**, `localStorage` events, or a shared in-memory session id — implementation detail; no server.

This is **not** “install two different browsers”; it is **two windows (or tabs) from one app**, analogous to PowerPoint’s presenter + projector displays. If the browser blocks `window.open`, or only one screen is available, **fallback:** split layout on a single window (presenter panel + audience panel).

**Dual-monitor setup:** drag the audience window to the projector; keep the presenter window on the laptop.

### 8.5 Annotations — phased

#### Phase 1 (MVP) — Present-time & app-owned rehearsal

| Capability | Persist? | Opens in Adobe? |
|------------|----------|-----------------|
| Laser pointer | No | N/A |
| Temporary pen/highlighter | No (or until slide change) | No |
| Per-slide **notes** (text) | Yes (app storage) | No |
| Rehearsal pen/highlighter overlay | Yes (app storage, keyed by page) | No |

Implementation: canvas/SVG **overlay** per page index; serialise to JSON in **IndexedDB** or `localStorage` (deck fingerprint: file name + size + last modified + page count).

#### Phase 2 — Export & share

- Download **clean PDF** (original bytes).
- Download **flattened PDF** (render pages + burn-in overlay). **Decision:** flattened export is **sufficient** for Phase 2; strict Adobe Reader annotation-object compatibility is **not** required unless Phase 3 is prioritised.
- Optional: export notes as **speaker notes PDF** or sidecar JSON.

#### Phase 3 — Standards-native annotations (only if validated)

- Highlight, ink, sticky notes as PDF annotation objects for compatibility with Reader.
- Higher engineering cost; tablet pressure; undo stack; spec edge cases.

**Default MVP:** Phase 1 only. Phase 2 when users require “send marked PDF to legal/comms.”

### 8.6 Keyboard shortcuts (MVP baseline)

Align with familiar presenter tools where possible:

| Key | Action |
|-----|--------|
| → / Space / PgDn | Next slide |
| ← / PgUp | Previous slide |
| Home / End | First / last slide |
| F / Enter | Toggle fullscreen |
| Esc | Exit fullscreen / exit Present |
| B | Black screen |
| W | White screen |
| G | Go to slide (modal) |
| ? | Shortcut help overlay |

### 8.7 Privacy & data handling

- **Default:** PDF bytes and annotations stay **on device**; no API route for file upload in MVP.
- **Decision:** No organisational requirement to host decks on a server for MVP; library/hosting remains **post-MVP** only.
- Document in UI: “Your file is not sent to our servers.”
- Clear **local data** control (forget deck / clear annotations).
- If a hosted deck library is added later, require explicit opt-in and organisation policy review.

### 8.8 Password-protected PDFs

Many corporate PDFs use a **user password** (open password) or **owner password** (restrictions). PDF.js can decrypt in the browser when the correct password is supplied.

#### UX flow (MVP)

1. User selects or drops a PDF; the app loads bytes in memory and calls `pdfjs.getDocument({ data, password })` (password omitted on first attempt).
2. If the document is encrypted and needs a password, PDF.js rejects with a **password-required** outcome → show a **modal dialog**:
   - Title: e.g. “This PDF is password-protected”
   - Single **password** field (type `password`), **Open** and **Cancel**
   - On submit, retry `getDocument` with the entered password.
3. **Wrong password:** show inline error (“Incorrect password”), keep modal open, do not clear the file picker context; allow retry or Cancel.
4. **Cancel:** return to the open screen; discard loaded bytes for that attempt.
5. **Success:** proceed to Rehearse/Present as for an unencrypted file. Do **not** show the password again unless the user closes and re-opens the file.

Optional v1.1: checkbox “Remember for this session” — keep password **only in memory** (React state / session closure) for reloads of the **same** file fingerprint during the tab lifetime; **never** write passwords to `localStorage`, IndexedDB, or the server.

#### Security & privacy

| Rule | Rationale |
|------|-----------|
| Password stays **client-side** | Same model as the PDF bytes; never POST password to an API in MVP. |
| **Do not persist** password by default | Reduces risk on shared machines. |
| Clear password from memory on **Close deck** / tab close | Limit exposure. |
| No password in URLs or query strings | Avoid leakage via history and logs. |

#### Technical notes (PDF.js)

- Pass `password` to `getDocument` on retry after `PasswordException` or when `loadingTask.onPassword` fires (PDF.js API varies slightly by version; use the documented callback pattern for the pinned `pdfjs-dist` release).
- Distinguish **user password** (required to open) vs **owner password** (may only restrict printing/copying); if only owner restrictions apply, PDF.js may open without a prompt — handle gracefully.
- **Unsupported encryption:** some legacy or certificate-based PDFs may fail in PDF.js. Show: “This PDF uses encryption we can’t open in the browser. Try removing the password in Acrobat or re-exporting.”

#### Out of scope (MVP)

- Password **recovery** or cracking.
- Storing passwords in an org deck library (hosted phase would need a separate security review).
- Removing or changing PDF security permissions (not a presenter tool).

#### Success criteria (addition)

- [ ] User can open a standard **AES-encrypted** slide deck with a known user password via the prompt and present fullscreen.

## 9. Non-functional requirements

| Area | Requirement |
|------|-------------|
| **Performance** | First slide visible within **3 s** for a typical 30-slide, &lt; 20 MB deck on a mid-range laptop. Decks **50–100 MB** may take longer; soft warning sets expectation. |
| **Memory** | Do not render all pages at once; cap concurrent canvases; degrade gracefully on low memory. Reject files **&gt; 100 MB** before read. |
| **Reliability** | Corrupt PDF → user-visible error; no blank white screen without message. |
| **Accessibility** | Keyboard-operable presenting; focus management in modals; slide counter available to screen readers; do not rely on colour alone for tool state. |
| **Browsers** | Latest Chrome, Edge, Safari, Firefox (last two major versions); presenter view tested on dual-monitor setup. |
| **Security** | Treat PDF as untrusted input; keep PDF.js patched; CSP on deployed site; no `eval` of PDF content. Passwords held in memory only; never logged. |

## 10. Technical direction (implementation guide)

| Layer | Recommendation |
|-------|----------------|
| Framework | Next.js (App Router) or Vite + React — match team familiarity (`ppt-auditor/` uses Next.js 16). |
| PDF render | `pdfjs-dist` (Mozilla PDF.js) |
| Overlay annotations | React canvas or SVG layer per page |
| Persistence | IndexedDB for notes + overlay JSON |
| PDF export (Phase 2) | `pdf-lib` or server-side render pipeline |
| Hosting | Static/edge-friendly deploy; no server required for MVP |

New app lives in a **sibling folder** at repo root: **`pdf-presenter/`** (working product name matches repo folder). Not inside `ppt-auditor/`.

## 11. UI / UX principles

- **Audience view:** black surround, no toolbars, optional minimal progress indicator.
- **Rehearse view:** thumbnails + notes panel + tool palette.
- **Present view:** hide chrome after idle; show slide number on brief hover or keypress.
- Onboarding: one screen—“Drop PDF to begin”—plus link to keyboard shortcuts.
- Do not duplicate Acrobat’s menus; max **3–5** visible tools in rehearsal.

## 12. Success criteria

### MVP launch

- [x] User can open a multi-page PDF and present fullscreen with keyboard navigation.
- [x] User can add **per-slide notes** and see them in **presenter view** with **next slide** preview.
- [x] User can use **laser** and **temporary ink** in Present mode.
- [x] User can save rehearsal markup locally and reopen the same file without losing marks (same browser/device).
- [x] No server upload in default path; privacy called out in UI.
- [x] User can export **original PDF**, **flattened PDF** (rehearsal ink), and **notes JSON** from the session hub.
- [ ] Tested on at least one **real corporate deck** (20–40 slides) and one **image-heavy** export.

### Qualitative

- At least **3 presenters** prefer this over “open PDF in Reader fullscreen” for internal meetings, or articulate a single missing feature to reach that bar.

## 13. Milestones

| Phase | Deliverable |
|-------|-------------|
| **M0** | PRD approved; scaffold `pdf-presenter/` app; PDF.js single-page render + navigation. |
| **M1 (MVP core)** | Fullscreen Present mode; shortcuts; slide counter; fit-to-screen. |
| **M2 (MVP presenter)** | Per-slide notes; presenter view window; Rehearse mode. |
| **M3 (MVP ink)** | Laser + temporary ink; rehearsal overlay persistence (IndexedDB). |
| **M4** | Export flattened/marked PDF; polish, a11y pass, README + demo GIF. |
| **Later** | Deck library, auth, PDF-native annotations, PWA offline. |

## 14. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Feature parity trap with Adobe | Phase annotations; lead with presenter view + notes. |
| Large PDFs crash tab | Page cache limits; warn on file size; optional “lite mode”. |
| Notes not portable | Set expectation; Phase 2 export; sidecar format documented. |
| Dual-window blocked by browser | Fallback split layout on single screen. |
| PDF page size ≠ slide aspect | Letterbox; optional “crop to content” later. |
| Encrypted PDF unsupported in PDF.js | Clear error; suggest re-export without encryption or open in desktop tool. |
| Password on shared PC | Default: do not persist password; session-only opt-in later. |

## 15. Decisions (resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | Product / repo name | **`pdf-presenter`** — good enough for UI and folder name. |
| 2 | Dual-window presenter view for MVP? | **Yes.** Two **windows** (or tabs) from the **same app** in one browser: audience + presenter, synced. Not two different browsers. Fallback: single-window split layout. See §8.4. |
| 3 | Phase 2 export vs Adobe Reader? | **Flattened PDF is sufficient**; Reader-native annotation objects deferred to Phase 3 if ever. |
| 4 | Hosted deck library / server upload? | **No** organisational requirement for MVP; client-only default. |
| 5 | Password-protected PDFs? | **Yes** — prompt for password on open; client-side only; see §8.8. |
| 6 | Max file size? | **100 MB** hard cap; **50 MB** soft warning. Client-side only. See §8.1.1. |

## 16. Open questions

1. **Session-only password remember** — include in MVP or defer to v1.1?

## 17. Relationship to `ppt-auditor/`

The archived **deck compatibility auditor** in `ppt-auditor/` remains in the repository for reference and portfolio history. It is **not** part of this product’s runtime. Optional future link: “Export PDF from PowerPoint, then open here”—documentation only, no `.pptx` parsing in this app.

## 18. Document control

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-05-16 | — | Initial PRD; pivot from PPT auditor |
| 0.2 | 2026-05-16 | — | Decisions §15; dual-window §8.4; password-protected PDFs §8.8 |
| 0.3 | 2026-05-16 | — | 100 MB file cap + 50 MB soft warning (§8.1.1) |
| 0.4 | 2026-05-16 | — | M4 export (flattened PDF, notes JSON); a11y polish |
