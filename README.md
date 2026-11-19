# Room Studio (proof of concept)

A customer uploads a photo of a room (kitchen, hall, bedroom…), picks styles and changes
(wall colour, shutters, countertop, flooring, ceiling, furniture, extras), and gets several
AI-redesigned versions of **the same room** to compare side by side.

It also accepts a **Cabinet Vision 3D render** and turns it into a photoreal image
(the idea from the "Render Enhancer" prototype), using the same pipeline.

This is a proof of concept for EUC Technowood. Its main job is to test, on real customer
photos, whether the AI output is good enough before we build the full platform.

## Quick start

```bash
npm install
cp .env.example .env      # add GEMINI_API_KEY, or leave it empty for mock mode
npm run dev               # UI: http://localhost:5173  ·  API: http://localhost:8787
```

Without a key the app runs in **mock mode**: everything works, but each "design" is your
photo unchanged. That is enough for UI work.

Production-style run: `npm run build && npm start`. One server on port 8787 serves both
the UI and the API.

## How it works

```
Browser (React)                         Server (Express)                     AI image model
─────────────────                       ────────────────                     ──────────────
1. shrink photo to 1536px JPEG   ──►    2. validate ids against catalogue
   + room type, styles, changes         3. build one prompt per style   ──►  4. edit the photo
                                        5. run all styles in parallel   ◄──     (Gemini today)
6. before/after slider, download  ◄──      per-IP hourly image limit
```

| Path | What it does |
| --- | --- |
| `shared/catalog.ts` | **All design options** (rooms, styles, wall colours, finishes…) and the prompt text for each. Edit this file to add or reword options. |
| `server/prompt.ts` | Turns a request into the AI prompt, plus the guardrails ("keep the windows", "nothing floating"…). Most quality tuning happens here. |
| `server/providers/` | One adapter per AI service behind a common interface. `gemini.ts` is real; `index.ts` also has the mock. |
| `server/validate.ts` | Request checks. Only catalogue ids reach the prompt; free text is capped at 300 characters. |
| `server/quota.ts` | Images per visitor per hour, because every image costs money. |
| `src/` | The React UI: uploader, design panel, results with before/after slider. |

Each result card has a **"Prompt sent to the AI"** section. Use it while tuning prompts.

## Adding another AI service

Create `server/providers/<name>.ts` that implements `ImageEditProvider` (`edit(input) → { mimeType, base64 }`),
register it in `server/providers/index.ts`, and set `IMAGE_PROVIDER=<name>`. Good candidates to compare
quality against Gemini: OpenAI's image edits API, FLUX Kontext (via fal.ai or Replicate), and
open models such as Qwen-Image-Edit.

## Known limits of this POC

- No accounts, no saved projects, no database. Results live only in the browser tab.
- Images travel as base64 JSON. Fine for testing; production should upload to object storage (S3/R2) and pass URLs.
- The hourly limit is in memory and keyed by IP. Behind a proxy, set Express `trust proxy`.
- AI output is a **concept image**: not to scale, not a quote, not a buildable design.

## Suggested next steps

1. **Quality test (now):** collect 30–50 real customer photos (kitchens, halls, bedrooms, good and bad lighting).
   Run them through 2–3 models and score whether the room structure is kept, whether the changes were applied, and whether it looks realistic.
2. **MVP:** phone-OTP login, saved projects, a "Get a quote for this design" lead form, admin view of leads,
   image storage, per-account quotas, and usage and cost tracking.
3. **Precise edits:** tap a wall, cabinet or floor to change only that area (segmentation mask + inpainting).
4. **Real catalogue:** each manufacturer uploads their actual laminates and finishes as swatch images;
   the model uses them as reference images, so customers see real, orderable products.
5. **White-label:** one portal per manufacturer (their logo, catalogue, leads), managed by EUC.
