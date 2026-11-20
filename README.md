# EUC Room Studio

An internal design tool for EUC Technowood's staff. Upload a customer's room photo or a
Cabinet Vision render, pick styles and finishes, compare before and after, and download
the designs to share with the customer.

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

Production-style: `npm run build && npm start` (one server on port 8787 serves the UI and the API).

Without an AI key the app runs in **mock mode** (each design is your image unchanged), which is enough for UI work.
Open the studio with `?debug` to see the exact prompt sent to the AI for each design.

## Folder structure

```
shared/            Code used by both sides
  catalog.ts         All design options (rooms, styles, finishes, extras) and their prompt text
  types.ts           Request / response types
server/
  index.ts           Starts the server
  app.ts             Builds the Express app
  config.ts          Reads .env once
  routes/            redesign.ts (POST /api/redesign, GET /api/health)
  services/          prompt.ts (AI prompt + guardrails) · validate.ts (zod) · rateLimiter.ts
  providers/         One adapter per AI service: xai.ts · gemini.ts · mock (index.ts)
src/
  main.tsx · App.tsx   Entry and routes
  pages/               StudioPage.tsx (landing + one-screen studio)
  components/          layout/ · studio/ (Hero, StudioBar, DesignPanel, Viewer, CompareSlider) · ui/
  api/                 fetch wrappers for the server
  lib/                 image resizing, blob downloads, fit-to-screen sizing
  styles/              tokens.css (brand colours) · base · layout · studio
tests/ui/          End-to-end UI check (see the comment at the top of studio.check.mjs)
public/brand/      EUC logo and the landing-page showcase images
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
node tests/ui/studio.check.mjs http://localhost:8798 public/brand/manufactured.jpg /tmp/ui-shots ~/snap/brave/common/dl
```
