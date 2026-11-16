# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

p-quizzz is a practice-quiz app that runs **locally on one mentor's machine**; members join from browsers over a **LAN**. One mentor, no member accounts: members type a display name per session.

**`docs/PRODUCT.md` is the source of truth for business rules** (Vietnamese). Read it before implementing any feature, and update it first when a business rule changes. Do not restate its rules here.

**`docs/architecture.md` is the implementation contract**: data model, session state machine, API endpoints, auth, SSE and the chosen libraries. Work is split into stories in `docs/stories/`. When implementing a story, follow `docs/stories/README.md` (scope rules, Definition of Done, dependency order). Do not change the contract silently.

The rules that most often affect code:
- **Layering** (Clean Architecture, epic #7 đã xong): xem `docs/architecture.md` §9 và `docs/how-to-add-a-feature.md` trước khi thêm code server/web mới. Mọi file dưới `src/` phải nằm trong một layer; `npm run arch:check` chặn import vượt layer.
- **Exam** (question content, imported from Markdown) is separate from **Session** (one run of an exam). Sessions have a `mode`; only `self_paced` is in scope now, while `live` is phase 2, so don't hard-code a single mode.
- Session lifecycle: `DRAFT → LOBBY → RUNNING → CLOSED → FINALIZED`. Answers and explanations are revealed only from `CLOSED` onward.
- Every participant gets exactly **one attempt per session**, for every exam type. To retake, the mentor opens a new session from the same exam.
- The Markdown exam format (`docs/exam-format.md`) is both what the mentor reviews and what is imported. There is no intermediate conversion format. When writing or editing exams, use the `exam-authoring` skill.

## Commands

```bash
npm run dev        # Vite on :5173 (proxies /api → :3000) + Fastify via tsx watch on :3000
npm start          # vite build, then Fastify serves API + dist/web on :3000 (--serve-web flag)
npm test           # vitest run
npx vitest run src/server/app.test.ts -t "returns ok"   # single file / single test
npm run typecheck  # tsc --noEmit (no separate lint step yet)
npm run arch:check # layer dependency rules (docs/architecture.md §9.2); also runs inside npm test
npm run db:generate  # drizzle-kit: generate migration after editing src/server/infrastructure/db/schema.ts
npm run exam:check -- exams/<file>.md   # validate exam Markdown; exit 1 on errors
```

The server runs TypeScript directly via `tsx` in both dev and `start`; there is no server compile step. Env overrides: `PORT`, `HOST`, `DB_FILE` (see `src/server/config.ts`).

## Architecture

Single npm package (ESM), three source areas under `src/`:

- `src/server/`: Fastify 5 + better-sqlite3 + Drizzle ORM, layered as in `docs/architecture.md` §9 (`domain`, `application/{ports,use-cases}`, `infrastructure/{db,events,auth,system}`, `interface/http`, `composition.ts`). Module-by-module guide: §11.
  - `app.ts` `buildApp()` assembles the Fastify app **without listening**, taking the use cases from `composition.ts` (`compose(db)`). Tests call it with `createDb(':memory:')` via `src/server/test/helpers.ts` (`createTestApp`) and use `app.inject()`. `index.ts` is the only entry point that listens, opens the real DB file and prints LAN URLs.
  - Routes are Fastify plugins in `interface/http/*-routes.ts` (parse input with zod, call one use case, present the result). All API paths start with `/api/`. With `--serve-web`, every other GET falls back to `index.html` (SPA).
  - Business rules live in `domain/` (pure) and `application/use-cases/`; SQL only in `infrastructure/db/` (Drizzle schema in `schema.ts`, migrations in `migrations/`). SQLite file defaults to `data/p-quizzz.db` (gitignored).
  - Integration tests over HTTP are in `src/server/test/integration/`; use-case tests use the in-memory fakes in `application/testing/`.
- `src/web/`: React 19 SPA. This is the Vite `root` (see `vite.config.ts`), and builds to `dist/web`. Layered as in `docs/architecture.md` §9, §12: `features/<feature>/{domain,application,infrastructure,ui}`, `shared/` (UI kit, hooks, api-client, ports), `app/` (`main.tsx` entry, `router.tsx`, `composition.ts` = the web composition root, `AppProviders.tsx`). Features never import each other; the app composes them. `features/member-exam` is the reference feature.
- `src/shared/`: types and pure logic shared by both sides (API contracts). It must not import Node or DOM APIs.
  - `exam-format/`: line-based parser + validator for exam Markdown. It is the single implementation used by the CLI (`scripts/check-exam.ts`), and later by the server import endpoint and the web preview. Errors and warnings carry 1-based line numbers and Vietnamese messages for the mentor. Changing the format means updating `docs/exam-format.md`, the parser and `parse.test.ts` together.

Imports use `.js` extensions on relative paths (ESM + `moduleResolution: Bundler`).

## Constraints

- **Offline-first:** the LAN may have no internet. Do not load anything from CDNs, Google Fonts or external APIs at runtime; bundle every asset.
- **Cross-platform:** the mentor's OS is not fixed. npm scripts must not use POSIX-only syntax such as `VAR=x cmd`. Use CLI flags or `config.ts` instead.
- The server binds `0.0.0.0` so LAN members can connect.
- Realtime updates (lobby, projector leaderboard) are needed in the MVP. Use SSE or polling now; WebSocket is reserved for the phase-2 live mode.
- Real exams live in `exams/` (gitignored, since they contain answers and members may read the repo). Only `exams/examples/` is committed.
- Code and comments are in English; user-facing UI text and docs are in Vietnamese.
