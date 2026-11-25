# Architecture

How Dream Studios is put together, and the rules that keep it that way. For what the product does, see the
[README](../README.md); for what is planned, [PLAN.md](PLAN.md).

## The shape of it

```
Browser (React)                                    Server (Express)                         AI services
┌──────────────────────────────┐   JSON /api/*   ┌───────────────────────────────────┐    ┌───────────┐
│ features/studio              │ ──────────────► │ http        middleware, quota,    │    │ xAI       │
│   StudioPage   (layout)      │                 │             errors, static files  │    │ Gemini    │
│   hooks/       (state)       │                 │ modules/*   routes → service      │ ─► │ mock      │
│   components/  (UI)          │ ◄────────────── │             → prompts / schema    │    └───────────┘
│   lib/         mask, paste-  │   images as     │ providers/  one adapter per AI    │
│                back (canvas) │   data URLs     │ lib/        errors, validation    │
│ api/           fetch calls   │                 │ config.ts   env, checked once     │
└──────────────────────────────┘                 └───────────────────────────────────┘
                 ▲                                               ▲
                 └──────────── shared/  catalogue + API types ───┘
```

An AI request carries its image as a data URL: browser → server → AI → server → browser. The browser pastes back the
marked area, then (in a project room) stores the result in the room's history with `POST /api/rooms/:id/images`.
Image bytes live in the image store (`server/storage`, files under `DATA_DIR/images`); their records, and everything
else, in SQLite (`server/db`). The quick studio (`/studio`) stores nothing.

## Server (`server/`)

| Layer | Folder | Does | May import |
| --- | --- | --- | --- |
| Entry | `index.ts` | Loads `.env`, builds `Config` and providers, listens, shuts down on SIGTERM | everything |
| Composition | `app.ts` | `createApp({ config, providers })`: wires middleware, modules and the error handler | everything below |
| HTTP | `http/` | Security headers, per-IP quotas, `{ error }` responses, serving `client/dist` | `lib` |
| Modules | `modules/<name>/` | One feature each: `*.routes.ts` → `*.service.ts` → `*.prompts.ts` / `*.schema.ts` | `lib`, `providers/types`, `http/quota` (routes only), `shared` |
| Providers | `providers/` | One adapter per AI service behind `ImageEditProvider` / `TextProvider` | `lib` |
| Library | `lib/` | Error types, image data URLs, zod building blocks, the rate limiter | `shared` |
| Config | `config.ts` | The **only** reader of `process.env`; returns a typed `Config` or throws `ConfigError` | — |

Rules:

- **Routes stay thin.** Parse the body (throws a 400 `RequestError`), take quota (throws a 429), call the service,
  `res.json` the result. No try/catch: Express 5 sends thrown errors to `errorHandler`.
- **Services hold the use case** and know nothing about Express. They build prompts, call a provider with a timeout,
  and turn failures into an `AppError(502, …)` with a message staff can act on (`describeAiFailure`).
- **Only `AppError` messages reach staff.** Anything else is a generic "Server error." in production, and the real
  message in development.
- **Modules never import other modules' internals.** Shared building blocks go in `lib/` (server) or `shared/`
  (both sides).
- **No hidden globals.** Providers, limits and flags arrive through `createApp`, so tests build the whole app with
  the mock provider (`server/app.test.ts`).
- **Prompts are built on the server only**, from catalogue ids resolved by the schema. Staff text goes in as a
  quoted detail inside a template, never as the whole prompt.

### Modules today

| Module | Endpoints | Notes |
| --- | --- | --- |
| `health` | `GET /api/health` | Render's health check; the app bar shows the provider name |
| `auth` | `POST /api/auth/login`, `/logout`, `/password`, `GET /api/auth/me` | Sessions (cookie + hashed token), first-admin bootstrap |
| `team` | `GET/POST /api/team`, `PATCH /api/team/:id`, `GET /api/team/directory`, `GET /api/usage` | Admins manage staff, roles, daily limits; usage summary |
| `workspace` | `/api/clients`, `/api/projects` (+ `/members`, `/rooms`), `/api/rooms/:id` (+ `/images`, `/designs`), `/api/images/:id`, `/api/designs/:id` | Clients, projects, team access, rooms, image history, saved designs. Access rules in `workspace.repo.ts` (`projectAccess`) |
| `studio` | `POST /api/edit` (change, add, remove), `/api/redesign`, `/api/generate`, `/api/final` | Mark & edit, Standard (options A–D), Generate (concepts in a style), Final 2K. Charged against the person's daily limit and logged |
| `assist` | `POST /api/assist`, `/api/recommend` | "AI help" for prompt bars; furniture recommendations. Built-in answers in mock mode |
| `usage` | (service only) | Usage log and daily limits, used by `studio`, `assist`, `auth` and `team` |

Every `/api` request passes `authenticate` (sets `req.user` from the session cookie); routes declare what they need
with `requireUser` / `requireRole(...)` (`http/auth.ts`). Only `/api/health` and `/api/auth/login` are open.

### Adding an AI service

1. `server/providers/<name>/image.ts` (and `text.ts` if it has a text model) implementing the interfaces in
   `providers/types.ts`, throwing `ProviderError` on failure.
2. Its settings in `config.ts` (schema, `ImageProviderConfig` / `TextProviderConfig`, the provider switch).
3. A case in `providers/index.ts`. Nothing else changes.

## Client (`client/src/`)

| Folder | Does |
| --- | --- |
| `main.tsx`, `app/` | Entry point and routes |
| `app/auth.tsx` | Who is signed in (`useAuth`), `RequireAuth` for routes; a 401 anywhere returns to sign-in |
| `features/auth`, `features/workspace`, `features/team` | Sign-in; projects, clients, project, room (history, saved designs, presentation board); team and usage |
| `features/studio/` | The studio, everything it alone uses. `RoomStudioPage` opens it for a project room; `usePersist` stores each result there |
| `  StudioPage.tsx` | Layout only: reads `useStudio()` and passes props down |
| `  hooks/` | State and actions. `useSession` (photo, stack of changes, final image, busy, downloads, leave warning) is shared by `useMarkEdit` and `useStandardDesign`; `useStudio` composes them and handles undo, try again, Final 2K and downloads; `useShortcuts` binds keys and paste |
| `  model/` | Types and pure helpers for the session (`steps.ts`, `design.ts`). No React |
| `  components/` | Presentational pieces: panels, viewer, mask editor, prompt bar |
| `  lib/` | Canvas work: the mark (`mask.ts`) and paste-back / alignment (`composite.ts`) |
| `api/` | Typed fetch wrappers over `shared/types.ts`: the only code that talks to the server |
| `components/` | UI shared across features: app bar, icons, file drop |
| `lib/` | Generic browser helpers: image preparation, downloads, fit-to-screen sizing |
| `styles/` | `index.css` imports every stylesheet in cascade order; `tokens.css` holds all colours, fonts and radii; `studio/` is one file per area of the studio |

Rules: components get data and callbacks through props; state lives in hooks; anything without React goes in
`model/` or `lib/` so it can be unit-tested. A new feature (for example `features/admin/`) gets its own folder with the
same shape.

## Shared (`shared/`)

`catalog.ts` (room types, parts, materials, shades, suggestions and their prompt words), `styles.ts` (design styles as
colour/material combinations over the catalogue, furniture by room type), `types.ts` (studio request and response
types) and `workspace.ts` (accounts, clients, projects, rooms, images: API shapes and roles). Both sides import it as `@shared/...`. It must stay free of Node and DOM APIs.

## Tests

| Command | What |
| --- | --- |
| `npm test` | Vitest unit tests next to the code (`*.test.ts`): config, the HTTP app with the mock provider, schemas, prompts, AI help parsing, rate limiter, client model |
| `npm run check` | Typecheck both sides, then the unit tests |
| `tests/ui/*.check.mjs` | Browser checks of the whole studio and of paste-back over the Chrome DevTools Protocol (see README) |

## Deployment today

Vercel serves the built client and rewrites `/api/*` to the Render web service (`render.yaml`), which runs
`npm start`. Locally and in the planned single-VPS setup, one Node process serves both `client/dist` and the API.
