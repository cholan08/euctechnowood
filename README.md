# EUC Dream Studios

An internal AI interior design studio for EUC Technowood's staff, behind a sign-in.

**Studio management.** Clients → projects → rooms. Each room keeps its full **image history** (the photo, every
change, every option and concept, final images and boards) and its **saved designs** for the client. **Team access**:
admins add staff as *admin*, *designer* or *viewer*, set daily image limits and see usage; a project's owner chooses
who else may edit it (everyone may view). The **Quick studio** (`/studio`) works without a project and stores nothing.

**Three ways of working** in the studio (switch at the top of the panel; all add to the same list of changes):

- **Generate** (empty or unfinished room): pick a **style** (Modern, Luxury, Minimalist, Industrial, Scandinavian,
  Contemporary Indian, Classic) and its **colour combinations**: one **concept** each, up to four. Every part of each
  concept can be customised, **furniture recommendations** can be ticked (or asked of the AI for the brief, in any
  language), plus a brief and lighting. Walls, windows, doors, ceiling and camera always stay.

- **Mark & edit** (**Change · Add · Remove**): pick the part (base cabinets, countertop, wall paint...), mark it on the photo, then **click one of
  the suggested changes** that appear ("Sage green laminate, super-matte"). A custom finish (material, shade, sheen)
  or your own words ("light grey with fluted grooves") work too. **Item photo**: to put a sofa, chair or light from
  another photo into the room, mark where it goes and attach (or paste) its photo; both photos go to the AI.
  **Add** puts a new object (in words, or from a photo) in the marked area; **Remove** takes the marked object away and
  fills in what was behind it. Only the marked area changes.
- **Standard**: the full spec editor. **Start from a style** fills only the parts the customer wants changed with a
  style's combination (or makes options A–D from its combinations); every other part stays locked to the photo. Set a new finish for any part of the room, up to four options (A–D), plus
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
(`client/src/features/studio/lib/composite.ts`): it lines the AI image up with the photo (zoom and shift found on the unmarked
areas), matches its exposure, and pastes the marked area back with a soft edge. Every other pixel is the original
photo. Marking tools: **Brush**, **Corners** (click the corners of straight-edged parts such as cabinet fronts) and
**Eraser**.

**Where images live.** In a project room every result is saved to the room's history on the server as it is made
(database `DATA_DIR/studio.db`, files `DATA_DIR/images`), so nothing is lost on refresh and the team can open it. The
Quick studio keeps results only in the tab and warns before they would be lost. Photos are sent to the AI service to
be processed. See [docs/DECISIONS.md](docs/DECISIONS.md).

**Presentation board.** On a room page, pick up to three saved designs: the browser draws a branded 2400×1500 board
(EUC logo, client, project, the design large, the original, alternatives, what changes with swatches, palette, notes),
to download or keep in the room.

The build plan and current phase are in [docs/PLAN.md](docs/PLAN.md).

## Run it

```bash
npm install
cp .env.example .env     # add XAI_API_KEY (or GEMINI_API_KEY); empty = mock mode
                         # set ADMIN_EMAIL + ADMIN_PASSWORD for the first admin (or run `npm run create-admin`)
npm run dev              # UI http://localhost:5173 · API http://localhost:8787
```

Sign in with the admin account, then add staff on **Team**. There is no public sign-up.

Production-style: `npm run build && npm start` (one server on port 8787 serves the built UI from `client/dist` and the API).

All commands run from the project root; there is one `package.json` and one `.env` for both sides.

Without an AI key the app runs in **mock mode** (each change returns your image unchanged), which is enough for UI work.
Open the studio with `?debug` to see the exact prompt sent to the AI for the last change (or the final image).

Shortcuts: <kbd>Ctrl</kbd>+<kbd>V</kbd> pastes an image, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> applies the custom finish or typed words (Mark & edit) or generates (Standard), <kbd>Ctrl</kbd>+<kbd>Z</kbd> takes back the last brush stroke. With **Corners**: <kbd>Enter</kbd> closes the shape, <kbd>Backspace</kbd> removes the last corner, <kbd>Esc</kbd> cancels.

## Look and feel

A light, warm "interior magazine" look: warm-white paper background, white cards with soft shadows, charcoal text,
the Fraunces serif for page titles with Geist for everything else, and EUC's burnt orange (`#A94F18`, AA contrast
with white text) as the one accent for actions and selection. Room photos sit on a slightly darker warm canvas so they
stand out. The mark painted on photos is a vivid blue, so it shows on wood, stone and white walls. All colours, fonts,
radii and shadows live in `client/src/styles/tokens.css`.

## Folder structure

The layers, their rules and how to add a module or an AI service are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
project/
├── client/                 React + Vite frontend
│   ├── index.html
│   ├── vite.config.ts        Dev proxy /api -> :8787 · @shared alias · builds to client/dist
│   ├── public/               favicon.svg (Dream Studios mark) · brand/ (EUC logo, sample kitchen images used by the checks)
│   └── src/
│       ├── main.tsx · app/     Entry and routes
│       ├── features/studio/    The studio
│       │   ├── StudioPage.tsx    Layout only (start screen + one-screen studio)
│       │   ├── hooks/            useStudio (composes the rest) · useSession (photo, changes, final, downloads) · useMarkEdit · useStandardDesign · useShortcuts
│       │   ├── model/            steps.ts / design.ts: session types and pure helpers
│       │   ├── components/       StartScreen, SourceCard + mode switch, ChangePanel (Mark & edit), DesignPanel + ElementEditor (Standard), PromptBar (AI help), Viewer, MaskEditor, CompareSlider
│       │   └── lib/              mask.ts (the mark) · composite.ts (align + paste back, fit the final image)
│       ├── api/                Typed fetch wrappers for the server
│       ├── components/         Shared UI: layout/AppBar · ui/ (FileDrop, Icon)
│       ├── lib/                Image resizing, downloads, fit-to-screen sizing
│       └── styles/             index.css (cascade order) · tokens.css (all colours, fonts, radii) · base · shell · start · studio/ (one file per area)
├── server/                 Express API
│   ├── index.ts              Starts the server (reads .env, checks config, builds providers)
│   ├── app.ts                createApp({ config, providers }): middleware, modules, error handler, client/dist
│   ├── config.ts             The only reader of process.env, checked with zod
│   ├── http/                 Security headers, quotas, error responses, static files
│   ├── modules/              One folder per feature: routes → service → prompts / schema
│   │   ├── studio/             POST /api/edit (one marked change) · /api/redesign (Standard, options A–D) · /api/final (2K pass)
│   │   ├── assist/             POST /api/assist (AI help)
│   │   └── health/             GET /api/health
│   ├── providers/            One adapter per AI service: xai/ · gemini/ (image.ts, text.ts) · mock.ts · index.ts (picks from config)
│   └── lib/                  Error types, image data URLs, zod building blocks, rate limiter
├── shared/                 Code used by both sides (imported as @shared/...)
│   ├── catalog.ts            Room parts, materials, shades, finishes, suggested changes, moods, add-ons and their prompt text
│   └── types.ts              Request / response types
├── tests/ui/               Browser checks over the Chrome DevTools Protocol (see UI check)
├── docs/                   ARCHITECTURE.md · PLAN.md
├── vitest.config.ts        Unit tests (*.test.ts next to the code)
├── package.json            Scripts and dependencies for both sides
├── README.md
└── .env.example
```

## AI providers

`IMAGE_PROVIDER` = `xai`, `gemini` or `mock` (auto-picked from whichever key is set).
**xAI**: model `grok-imagine-image-2.0`. The `grok-4.x` models are chat models and cannot make images.
To add another service, create `server/providers/<name>/image.ts` implementing `ImageEditProvider`, add its settings to
`server/config.ts` and a case in `providers/index.ts` (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

## Tests

```bash
npm test          # unit tests (Vitest, mock provider, no API key needed)
npm run check     # typecheck both sides + unit tests
```

## UI check

```bash
npm run build
IMAGE_PROVIDER=mock PORT=8798 DATA_DIR=/tmp/rs-check IMAGES_PER_HOUR=1000 \
  ADMIN_EMAIL=admin@studio.test ADMIN_PASSWORD=admin-password-123 npm start &
brave --headless=new --remote-debugging-port=9333 about:blank &     # or chromium / google-chrome
# Studio management: sign-in, project, room upload, Generate, Remove, saved design, history, board, usage
node tests/ui/workspace.check.mjs http://localhost:8798 client/public/brand/manufactured.jpg /tmp/ui-shots admin@studio.test admin-password-123
# The studio itself (quick studio)
STUDIO_EMAIL=admin@studio.test STUDIO_PASSWORD=admin-password-123 \
  node tests/ui/studio.check.mjs http://localhost:8798 client/public/brand/manufactured.jpg /tmp/ui-shots ~/ui-downloads
```

A snap-packaged browser cannot write to `/tmp`, so give it a download folder in your home directory.

The paste-back check imports `client/src/features/studio/lib/composite.ts` from the Vite dev server (`npm run dev:web`), feeds it a synthetic AI
image that is zoomed, shifted and brighter, and measures that the result keeps the photo outside the mark and lines
up inside it:

```bash
node tests/ui/paste-back.check.mjs http://localhost:5173/ /tmp/paste-back.jpg
```
