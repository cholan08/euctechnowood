# EUC Room Studio

An internal design tool for EUC Technowood's staff. Upload a customer's room photo (or a Cabinet Vision image) and
change it in one of two ways (switch at the top of the panel; both add to the same list of changes):

- **Mark & edit**: pick the part (base cabinets, countertop, wall paint...), mark it on the photo, then **click one of
  the suggested changes** that appear ("Sage green laminate, super-matte"). A custom finish (material, shade, sheen)
  or your own words ("light grey with fluted grooves") work too. **Item photo**: to put a sofa, chair or light from
  another photo into the room, mark where it goes and attach (or paste) its photo; both photos go to the AI.
  Only the marked area changes.
- **Standard**: the full spec editor. Set a new finish for any part of the room, up to four options (A–D), plus
  lighting mood, add-ons, sample photos and a designer's note; the AI redraws the whole image. A Cabinet Vision render
  with no changes becomes photoreal.

**Prompt bars with AI help.** Every place you customise has a prompt bar for extra details in your own words:
Custom finish and each Standard part ("fluted grooves, gold edge on top"), the own-words change, and the designer's
note. Staff can type in English, Tamil, Hindi or Tanglish. **AI help** (a fast xAI text model, about 1 s and $0.001)
turns the words into three clear English options to click; with an empty bar it suggests ideas for that part and
finish. Only the text left in the bar goes into the image prompt ("Details: …"). Each suggested change also has an
adjust button that opens it in Custom finish.

Changes stack; the last one can be undone or tried again. When done, **Final 2K image** makes one realism pass over
the whole image at the AI's 2K size (xAI returns about 2900 px wide) and shows it next to the edited image, ready to
download.

**Mark & edit only changes the marked area.** The AI image model redraws the whole photo on every edit, so its output drifts from
the real room (textures, objects, framing). The browser therefore keeps only the area staff marked
(`client/src/lib/composite.ts`): it lines the AI image up with the photo (zoom and shift found on the unmarked
areas), matches its exposure, and pastes the marked area back with a soft edge. Every other pixel is the original
photo. Marking tools: **Brush**, **Corners** (click the corners of straight-edged parts such as cabinet fronts) and
**Eraser**.

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

Without an AI key the app runs in **mock mode** (each change returns your image unchanged), which is enough for UI work.
Open the studio with `?debug` to see the exact prompt sent to the AI for the last change (or the final image).

Shortcuts: <kbd>Ctrl</kbd>+<kbd>V</kbd> pastes an image, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> applies the custom finish or typed words (Mark & edit) or generates (Standard), <kbd>Ctrl</kbd>+<kbd>Z</kbd> takes back the last brush stroke. With **Corners**: <kbd>Enter</kbd> closes the shape, <kbd>Backspace</kbd> removes the last corner, <kbd>Esc</kbd> cancels.

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
│   ├── public/               favicon.svg (Room Studio mark) · brand/ (EUC logo, sample kitchen images used by the checks)
│   └── src/
│       ├── main.tsx · App.tsx  Entry and routes
│       ├── pages/              StudioPage.tsx (start screen + one-screen studio: both modes, changes, undo, try again, final 2K, downloads)
│       ├── components/         layout/AppBar · studio/ (StartScreen, SourceCard + mode switch, ChangePanel (Mark & edit), DesignPanel + ElementEditor (Standard), PromptBar (AI help), Viewer, MaskEditor, CompareSlider) · ui/ (FileDrop, Icon)
│       ├── api/                fetch wrappers for the server
│       ├── lib/                mask.ts (the mark) · composite.ts (align + paste back, fit the final image) · change.ts / design.ts (session state) · image resizing, downloads, fit-to-screen sizing
│       └── styles/             tokens.css (all colours, fonts, radii) · base · shell · start · studio
├── server/                 Express API
│   ├── index.ts              Starts the server
│   ├── app.ts                Builds the Express app (serves client/dist in production)
│   ├── config.ts             Reads .env once
│   ├── tsconfig.json
│   ├── routes/               studio.ts: POST /api/edit (one marked change) · /api/redesign (Standard, options A–D) · /api/final (2K pass) · /api/assist (AI help) · GET /api/health
│   ├── services/             prompt.ts (the image prompts) · assist.ts (AI help prompt + parsing) · validate.ts (zod) · rateLimiter.ts
│   └── providers/            One adapter per AI service: xai.ts · gemini.ts · mock (index.ts) · text.ts (text models for AI help)
├── shared/                 Code used by both sides
│   ├── catalog.ts            Room parts, materials, shades, finishes, suggested changes, moods, add-ons and their prompt text
│   └── types.ts              Request / response types
├── tests/ui/               Browser checks over the Chrome DevTools Protocol (see UI check)
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
node tests/ui/studio.check.mjs http://localhost:8798 client/public/brand/manufactured.jpg /tmp/ui-shots /tmp/ui-downloads
```

The paste-back check imports `composite.ts` from the Vite dev server (`npm run dev:web`), feeds it a synthetic AI
image that is zoomed, shifted and brighter, and measures that the result keeps the photo outside the mark and lines
up inside it:

```bash
node tests/ui/paste-back.check.mjs http://localhost:5173/ /tmp/paste-back.jpg
```
