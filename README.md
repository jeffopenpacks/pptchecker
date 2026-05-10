# Deck compatibility auditor

# Project Title: PPTauditor
 
## Overview 
### Problem 
- Who is affected?
Management staff who needs to make presentations often face guffaws such as misaligned fonts, out-of-place formatting
- What is the issue? 
Staffs who created the ppt may have created it on mac whereas the presentations were made on windows, and vice versa, due to many staff using their personal devices at work, it is not possible to have a uniform device stack.
 
### Outcome 
- What was achieved?
To help ppt designers flag out common pitfalls such as large image size, platform specific features and uncommon fonts
- Measurable results (if any). 
--- 
 
## Demo 
- How does the solution work from the user’s perspective, covering the main steps from start to finish?  
Once the user is done with the ppt, he/she can upload this to the webapp, it'll parse it then give a list of feedback, this can be exported into pdf, and user can send it to the presenter, who can do a quick double check on the flagged slides to double check.
- Provide screenshots, GIFs or demo video. 
--- 
 
## Technology Stack  

### Frontend components  

- **Next.js (App Router)** — routing, layouts, and static shell for the home page  
- **React 19** — UI rendering (`DeckAuditor` upload flow and grouped findings)  
- **TypeScript** — typed components and shared shapes aligned with the API JSON  
- **Tailwind CSS v4** — layout, typography, severity badges (accessible text labels, not colour alone)  
- **Browser APIs** — `fetch`, multipart **`FormData`** upload (`Accept`: `.pptx`), runtime validation against the **50&nbsp;MB** client-side cap  

### Backend components  

- **Next.js Route Handlers** (`nodejs` runtime) — **`POST /api/analyse`**, multipart parsing, no persistence  
- **`fflate`** — synchronous unzip of the `.pptx` OPC/ZIP package  
- **`fast-xml-parser`** — OOXML/D relationships (`Relationships`), embedded font lists (`presentation.xml`), coarse markup scans  
- **Static analysis pipeline** — slide-level font hints, `ppt/media/` total ÷ reported slide count (heuristic density bands vs typical decks), external/OLE/effects **heuristics**  

--- 
 
## Development Approach with AI 
I used cursor agent for this.
1) Started with a quick discussion
2) Discussed tech stack
3) Set the scope to prevent scope creep
4) First build
5) Test with ppt
6) Give feedback 
7) Fix
--- 
 
## Installation  

### Prerequisites  

- **Node.js** **20.x** or newer (recommended for Next.js&nbsp;16)  
- **npm** (bundled with Node; **`pnpm`**/**yarn** work if you regenerate lockfiles consistently)  

### Steps  

1. **Clone** this repository and open a terminal at the **repository root** (where **`package.json`** lives).  
2. **Install dependencies:**  

   ```bash
   npm install
   ```

3. **Run the development server:**  

   ```bash
   npm run dev
   ```

4. Open **[http://localhost:3000](http://localhost:3000)** in a browser.  

### Useful scripts  

| Command | Purpose |
|--------|---------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Optimised production build |
| `npm start` | Serves the production build (run **`build`** first) |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run lint` | ESLint (Next.js + TypeScript rulesets) |

### Production  

After **`npm run build`**, deploy like any Node host that supports Next.js, or use **[Vercel](https://vercel.com/)**. Respect platform **request body limits** for large uploads.

--- 
 
## Usage 
How to use the project (commands, examples, expected behaviour). 
--- 
 
## Project Structure  

| Path | Role |
|------|------|
| **`src/app/`** | Next.js App Router: **`page.tsx`** (landing UI), **`layout.tsx`**, **`globals.css`**, and **`api/analyse/route.ts`** (multipart ingest → **`analysePptx`**) |
| **`src/components/`** | Client-only UI pieces (**`DeckAuditor`** — file picker, loading/error states, grouped findings by category) |
| **`src/lib/pptx/`** | Core analyser (**`analyse.ts`**), bounded unzip (**`unzip-opc.ts`**), thresholds (**`config.ts`**), **`types`** |
| **`src/lib/`** | **`rate-limit.ts`** (abuse throttle), **`server-log.ts`** (structured stderr without leaking internals) |
| **`tests/`** | Vitest suites; **`pptx/analyse.test.ts`** builds minimal synthetic `.pptx` blobs (**no real decks committed**) |
| **`docs/`** | Product/requirements (**`PRD.md`**), **`Brief.md`**, and Cursor/agent scaffolding (**`AGENTS.md`**, **`CLAUDE.md`**) |
| **`public/`** | Static assets served from the site root (template SVGs from scaffold; safe to replace) |
| **`scripts/`** | Placeholder for automation (currently empty aside from **`.gitkeep`**) |
| **`assets/`** | Optional repo-hosted imagery/media for docs or UI (**`.gitkeep`**) |
| **`data/`** | Optional datasets or fixtures (**`.gitkeep`**) — analysable decks stay **local**/upload-only unless you add them deliberately |

Root **`package.json`**, **`tsconfig.json`**, **`next.config.ts`**, **`vitest.config.ts`**, **`eslint.config.mjs`**, and **`postcss.config.mjs`** configure tooling app-wide.

--- 
 
## Reflection 
- What worked, what failed, changes made, rationale. 
It worked well, but I realise that pptx exported from canva doens't get audited properly as they don't match typical OOXML, so we added a warning to suggest only putting up pptx generated from typical apps like ms ppt or google slides. Verdict is that this is not very useful for everyday use except for pointing out obvious flags. Need to be able to simulate the slides itself on various OS in order to be able to foresee issues. We can either develop further to include more features or pivot into a different product.
