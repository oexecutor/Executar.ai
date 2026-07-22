# DESK-OS web (Gate 5, UI half)

Minimal Vite + React + TypeScript frontend for Today / Sprint / Kanban / task
create-update / login-logout, talking to `/api/pm/*` and `/api/admin/*`.

Net-new addition per `docs/IMPLEMENTATION_BASELINE.md` §1 — `public/index.html`
(the vault browser) is untouched and stays stable (DEC-002). This app builds
into `public/app/` and is served alongside it from the same Netlify site.

## Local development

```bash
npm install                 # from this directory
npm run dev                 # vite dev server, proxies /api to localhost:3000
                             # (run `vercel dev` at the repo root separately)
```

## Checks

```bash
npm run build                # tsc --noEmit + vite build -> ../public/app
npm test                     # component tests (vitest + jsdom + Testing Library)
npm run lint                 # eslint
npm run test:e2e             # Playwright: real Chromium, a mock API server
                              # (e2e/mock-server.ts), full user flow +
                              # axe accessibility checks on every screen
```

`test:e2e` does not require `netlify dev` — it serves the built `public/app/`
and a small in-process mock of `/api/admin/*` and `/api/pm/*`
(`e2e/mock-server.ts`) on `localhost:4173`, so it runs the same way locally
and in CI.

## What's here vs. what's next

Implemented: Today (dominant delivery, next action, in-progress/blocked),
Sprint board with the contract's 5 Kanban columns, task create/update,
first-run project bootstrap, login/logout, keyboard-accessible move controls
(a `<select>` per card, not pointer drag-and-drop).

Not yet implemented (see `docs/GATE_PROGRESS.md`): pointer drag-and-drop
reordering, a projects list/switcher (only "current sprint" is shown),
evidence/decomposition-proposal review UI, printable A4 summary beyond a
basic `@media print` stylesheet.
