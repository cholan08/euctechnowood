# EUC Technowood Room Studio (MVP)

A customer uploads a photo of a room, picks styles and changes (wall colour, shutters, countertop,
flooring, furniture…) and gets AI-redesigned versions of **the same room** with a before/after slider.
They can then **request a quote** for a design. The team sees every request, with the design attached, in `/admin`.

It also accepts a **Cabinet Vision 3D render** and turns it into a photoreal image.

## Run it

```bash
npm install
cp .env.example .env     # add XAI_API_KEY (or GEMINI_API_KEY); empty = mock mode
npm run dev              # UI http://localhost:5173 · API http://localhost:8787
```

Production-style: `npm run build && npm start` (one server on port 8787 serves UI + API).
In production `ADMIN_PASSWORD` and `SESSION_SECRET` are required.

Without an AI key the app runs in **mock mode** (each design is your photo unchanged), which is enough for UI work.
Open the studio with `?debug` to see the prompt sent to the AI on each result.

## Folder structure

```
shared/            Code used by both sides
  catalog.ts         All design options (rooms, styles, finishes) and their prompt text
  types.ts           Request / response types
server/
  index.ts           Starts the server
  app.ts             Builds the Express app (routes, static files)
  config.ts          Reads .env once
  routes/            redesign.ts · leads.ts · admin.ts   (HTTP only)
  services/          prompt.ts (AI prompt + guardrails) · validate.ts · rateLimiter.ts · imageStore.ts
  providers/         One adapter per AI service: xai.ts · gemini.ts · mock (index.ts)
  db/                SQLite: database.ts (schema) · designs.ts · leads.ts
  middleware/        adminAuth.ts (signed cookie login)
src/
  main.tsx · App.tsx   Entry and routes ( / and /admin )
  pages/               StudioPage.tsx · AdminPage.tsx
  components/          layout/ · studio/ · ui/
  api/                 fetch wrappers for the server
  lib/                 image resizing
  styles/              tokens.css (brand colours) · base · layout · studio · admin
data/                Created at runtime (git-ignored): euc.db and uploads/ (generated images)
```

## AI providers

`IMAGE_PROVIDER` = `xai`, `gemini` or `mock` (auto-picked from whichever key is set).
**xAI**: use model `grok-imagine-image-2.0`. The `grok-4.x` models are chat models and cannot generate images.
To add another service, create `server/providers/<name>.ts` implementing `ImageEditProvider` and register it in `providers/index.ts`.

## Known limits

- Single server, SQLite and local disk. For scale: Postgres + S3/R2 (only `server/db` and `services/imageStore.ts` change).
- No customer accounts or OTP yet; quotes are captured with name + mobile number.
- Rate limits are in memory, per IP.
- AI output is a **concept image**: not to scale, not a quote, not a buildable design.

## Roadmap

1. Quality test on 30–50 real customer photos across models.
2. Phone-OTP login, saved projects, WhatsApp/email alerts on new leads, cost tracking.
3. Tap-to-edit regions (segmentation + inpainting).
4. Real catalogue: manufacturers upload laminates/finishes as reference swatches.
5. White-label portals per manufacturer.
