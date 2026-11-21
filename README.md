# EUC Room Studio

An internal design tool for EUC Technowood's staff. Upload a customer's room photo or a
Cabinet Vision render, change its finishes part by part (up to four options), compare before and after, and download
the designs to share with the customer.

Two precision tools per part: **Match a sample** (a photo of the real laminate, tile or slab is sent to the AI with
the room photo, up to four per option) and **Where → Only one: pick on image** (click the one wall, island or unit to
change; the edit API has no masks, so the position goes into the prompt in words).

**Images are never stored.** Each design goes from the AI straight to the browser and
exists only in that tab until it is downloaded. The studio warns before anything
undownloaded would be lost.

The build plan and current phase are in [docs/PLAN.md](docs/PLAN.md).

## Run it

```bash
npm install
cp .env.example .env     # add XAI_API_KEY (or GEMINI_API_KEY); empty = mock mode
npm run dev              # UI http://localhost:5173 · API http://localhost:8787
```

Production-style: `npm run build && npm start` (one server on port 8787 serves the built UI from `client/dist` and the API).

All commands run from the project root; there is one `package.json` and one `.env` for both sides.

Without an AI key the app runs in **mock mode** (each design is your image unchanged), which is enough for UI work.
Open the studio with `?debug` to see the exact prompt sent to the AI for each design.

Shortcuts: <kbd>Ctrl</kbd>+<kbd>V</kbd> pastes an image, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> generates, <kbd>←</kbd>/<kbd>→</kbd> switch designs.

## Look and feel

Room Studio has its own dark "studio" design: a graphite workspace so the room images stand out, one electric-lime
accent for actions and selection, and the Geist / Geist Mono fonts. EUC appears as the client ("for EUC Technowood"
in the top bar). All colours live in `client/src/styles/tokens.css`.

## Folder structure

```
project/
├── client/                 React + Vite frontend
│   ├── index.html
│   ├── vite.config.ts        Dev proxy /api -> :8787 · builds to client/dist
│   ├── tsconfig.json
│   ├── public/               favicon.svg (Room Studio mark) · brand/ (EUC logo, start-screen example images)
│   └── src/
│       ├── main.tsx · App.tsx  Entry and routes
│       ├── pages/              StudioPage.tsx (start screen + one-screen studio, downloads, shortcuts)
│       ├── components/         layout/AppBar · studio/ (StartScreen, SourceCard, DesignPanel, Viewer, CompareSlider) · ui/ (FileDrop, Icon)
│       ├── api/                fetch wrappers for the server
│       ├── lib/                image resizing, blob downloads, fit-to-screen sizing
│       └── styles/             tokens.css (all colours, fonts, radii) · base · shell · start · studio
├── server/                 Express API
│   ├── index.ts              Starts the server
│   ├── app.ts                Builds the Express app (serves client/dist in production)
│   ├── config.ts             Reads .env once
│   ├── tsconfig.json
│   ├── routes/               redesign.ts (POST /api/redesign, GET /api/health)
│   ├── services/             prompt.ts (AI prompt + guardrails) · validate.ts (zod) · rateLimiter.ts
│   └── providers/            One adapter per AI service: xai.ts · gemini.ts · mock (index.ts)
├── shared/                 Code used by both sides
│   ├── catalog.ts            Room parts, materials, shades, finishes, add-ons and their prompt text
│   └── types.ts              Request / response types
├── docs/PLAN.md
├── package.json            Scripts and dependencies for both sides
├── README.md
└── .env.example
```

## AI providers

`IMAGE_PROVIDER` = `xai`, `gemini` or `mock` (auto-picked from whichever key is set).
**xAI**: model `grok-imagine-image-2.0`. The `grok-4.x` models are chat models and cannot make images.
To add another service, create `server/providers/<name>.ts` implementing `ImageEditProvider` and register it in `providers/index.ts`.

## UI check

```bash
npm run build
IMAGE_PROVIDER=mock PORT=8798 npm start &
brave --headless=new --remote-debugging-port=9333 about:blank &     # or chromium / google-chrome
node tests/ui/studio.check.mjs http://localhost:8798 client/public/brand/manufactured.jpg /tmp/ui-shots ~/snap/brave/common/dl
```
