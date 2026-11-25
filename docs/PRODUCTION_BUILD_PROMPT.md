# Build brief: Dream Studios, a professional AI interior design studio (production)

You are building a production web app from scratch. Read this whole brief before writing any code.

- Ask me before changing anything in section 2, "Decisions already made".
- When a detail isn't covered here, pick the simplest option that fits the goals and record it in `docs/DECISIONS.md`.
- Start with Phase 0 (section 13) and report its numbers before you build anything else.

---

## 1. The product

Dream Studios is an internal tool for the design staff of **EUC Technowood**, an Indian company that designs kitchens, wardrobes and other interiors in Cabinet Vision.

How it's used:
- The customer pays EUC a design amount and sits down for a design session.
- A staff member uploads the customer's room photo or a Cabinet Vision render.
- With the customer watching, they change finishes and items: cabinet shutters, countertops, backsplash, handles, walls, flooring, lights, furniture.
- The result must look like **a real photograph of the customer's own room**. The layout, camera angle, walls and windows stay the same. Only the requested changes appear.
- At the end, staff download or share a branded before-and-after presentation.

**The quality bar:** a customer shown the final image cannot tell it was edited, and recognises their own room.

---

## 2. Decisions already made

| Topic | Decision |
| --- | --- |
| Client | One: EUC. Not a multi-company SaaS. No public sign-up. |
| Users | EUC staff only, behind a login. |
| Billing | None in the app. EUC charges customers in its own process. |
| Customer photos | **Never stored on the server.** Image → AI → browser. Projects are saved in the staff member's browser (IndexedDB) and can be exported as a file. |
| AI | **OpenAI GPT Image** is the main provider. Put it behind a provider interface so another provider can be added later without changing the UI. |
| Layout | The uploaded photo **is** the approved layout. Never move, add or remove walls, windows, doors, cabinets or appliances unless the staff member asks for that specific item. |
| Styles | No whole-room "style presets" such as "Japandi". In the prototype, one moved the kitchen island and added a window. |
| Hosting | One VPS in India, in EUC's own cloud account, running Docker and Caddy on an EUC subdomain. |
| Accounts | The OpenAI account, VPS and domain are all in EUC's name, paid by EUC. |

---

## 3. Lessons from the prototype (must follow)

A prototype was built and tested with EUC staff. Use what it taught us. Don't copy its code.

1. **Prompts alone don't keep the room intact.** The only reliable method is to send a mask, then **paste back only the marked area** of the AI result in the browser, lined up and colour-matched. OpenAI says GPT Image uses the mask as guidance and "may not follow its exact shape", so paste-back is required.
2. **Simple by default.** Staff called a tabbed editor with many options "too advanced". The default flow makes one change at a time: pick a part → mark it → choose the change → apply. The full-room spec goes behind an "Advanced" mode.
3. **Staff type in Tamil, Tanglish and short English.** Real examples: "konjam fluted design venum, top la gold line podunga" and "shoba" (meaning sofa). Every free-text box must accept this, turn it into a clear English instruction, and show the staff member that English version before it is used.
4. **Real items from photos.** Staff want to place a specific sofa, light or handle from another photo into the room. Support item photos as reference images.
5. **Real catalogue, not generic colours.** Use EUC's actual laminates, quartz and handles (names, codes, swatch photos), sent to the AI as reference images.
6. **Never lose work.** In the prototype a page refresh lost everything. Save every project to the browser automatically.
7. **One screen on desktop.** The studio fits 1280×720 with no page scroll. Panels may scroll inside themselves.
8. **The AI is slow.** OpenAI says complex edits can take up to 2 minutes. Show partial previews as they arrive, never a bare spinner, and let staff keep working while it runs.

---

## 4. Users and devices

- **Designer (staff):** uses the studio.
- **Admin:** manages staff, daily budgets, the catalogue and suggested prompts, and sees usage and cost.
- **Devices:** desktop or laptop in the office, a tablet (iPad or Android) in the showroom, a phone for quick photos. Marking must work well with touch.

---

## 5. A design session, step by step

1. Sign in → **Projects** → **New project** (customer or project label).
2. **Add a room:** upload a photo, take one with the camera, or upload a Cabinet Vision render.
   - The app checks quality (too small, blurry, too dark, tilted) and gives one-line tips.
   - A vision model detects the room type and lists the visible parts to fill the part picker.
3. **Edit** in Mark & edit, the default (6.3), or in Advanced (6.4).
4. **Review:** variations, before/after slider, history with undo/redo.
5. **Final HD:** a last high-quality pass at full resolution (6.7).
6. **Present:** a branded PDF or image, shared on WhatsApp through the Web Share API or downloaded.

---

## 6. Features

### 6.1 Projects (saved in the browser only)

- Project → rooms → each room has its original image, a list of changes, and the chosen final.
- Autosave to IndexedDB after every change.
- **Export/import a project file** (a zip of JSON and images) so staff can move work between devices without server storage.
- Warn before leaving a page when work hasn't been exported or downloaded.
- Show browser storage use, with a "clean up old projects" action.

### 6.2 Upload and photo check

- Accept JPEG, PNG, WebP and HEIC (convert HEIC in the browser). Maximum 25 MB.
- Fix EXIF rotation. Resize in the browser before upload.
- Quality check in the browser: resolution, blur (variance of Laplacian), exposure, horizon tilt. Give tips, but always let staff continue.

### 6.3 Mark & edit (the default mode)

**Selecting the area:**
- **Click to select:** a segmentation model runs **in the browser**, for example SlimSAM or a SAM 2 variant via transformers.js / ONNX Runtime Web, with WebGPU and a WASM fallback. Staff click a cabinet and it is selected. Running it in the browser means photos aren't sent to another service. Benchmark it on a mid-range tablet; if it's too slow there, default that device to the brush.
- **Brush, Corners (polygon), Eraser,** with an adjustable size.
- **Add to and subtract from** the selection, **invert,** and a **feather** setting.
- Show the selection as a coloured overlay. Undo works per stroke.

**What to change (one at a time):**
- **Catalogue finish:** pick a swatch, which is sent as a reference image together with its name and code.
- **Suggested changes** for the selected part, shown as clickable chips. Admins can edit them. One click generates.
- **Own words** with AI help (6.10).
- **Item photo:** attach, drop or paste an item, and it is placed inside the marked area.
- **Remove / clean up:** remove clutter or an object and fill in what would be behind it.

**Variations:** 1–4 results per change (default 2) at draft quality. Staff pick one.

**Paste-back (in the browser):**
- Scale the AI result back to the original resolution.
- Blend it in through a feathered mask, and match colour and exposure in a band around the edge.
- **Pixels outside the mask and feather band must equal the original exactly.** Add a unit test that checks this.

### 6.4 Advanced: whole-room spec

- A spec for each part (cabinets, countertop, backsplash, walls, floor, lighting) with options.
- Every part that isn't changed is listed in the prompt as "keep exactly".
- The AI redraws the whole image, so the **drift check** (7.4) runs on every result.

### 6.5 Render to photo

- Turn a Cabinet Vision render into a photorealistic image with the same geometry, the same materials and the same camera.
- The drift check runs on every result.

### 6.6 Generate

- **Empty or unfinished room → designed room.** Keep the walls, windows, doors, ceiling and camera. Fill in cabinets and finishes from a short brief plus catalogue picks.
- **Concept board:** text to image for mood and inspiration. Always label it "Concept, not the customer's room".

### 6.7 Final HD

- Use the final model at high quality, with the photo's own aspect ratio, up to about 2560 px on the long edge. OpenAI marks sizes above 2560×1440 as experimental for GPT-Image-2.5.
- Optional lighting: daylight, warm evening, all lights on.
- The drift check runs. Show the final next to the edited image before download.

### 6.8 Compare and history

- Before/after slider, side-by-side view, zoom and pan, plus a full-screen view to present to the customer.
- The list of changes supports undo/redo, "try again" on any change, and "keep original".

### 6.9 Presentation and sharing

- Build a **branded PDF and image** in the browser (for example with pdf-lib) so the images never touch the server.
- Contents: EUC logo, before/after, the list of changes with **catalogue names and codes**, the date, the designer's name and a project label.
- Share through the Web Share API on phones and tablets (WhatsApp), or download.

### 6.10 AI help for free text

- Every free-text box has a **"Help me write"** button. A fast, low-cost OpenAI text model turns any input (English, Tamil, Tanglish, a few rough words) into **3 clear English options** for that part and change.
- An empty box gives ideas for the selected part.
- Show the English that will be sent. Staff can edit it.

### 6.11 Admin

- **Staff:** add, deactivate, reset password, set role, set daily budget.
- **Catalogue:** categories (laminate, quartz, handle, tile, paint, flooring, light, furniture), each item with a name, code, swatch photo, a short description for the prompt, and the room types it applies to. Catalogue swatches are EUC's own images, so storing them on the server is fine.
- **Suggested changes:** edit the clickable suggestions for each part.
- **Settings:** draft and final model, quality, default number of variations, USD→INR rate, drift threshold.

### 6.12 Usage and cost

- Log every AI call: who, when, project label, room type, action, model, quality, size, variations, tokens, estimated cost in ₹, time taken, and the status (ok / failed / refused / drift warning).
- **Daily budget per staff member in ₹**, set by an admin. Show staff "about N images left today", never dollar amounts.
- The admin dashboard shows totals by day, month and person, the failure rate and average time, with a CSV export.

---

## 7. AI integration (OpenAI)

**These facts come from OpenAI's docs as read on 25 Nov 2026. Check them again in Phase 0.**

### 7.1 Models and settings

- **Model IDs:** `gpt-image-2.6-sunburst`, `gpt-image-2.6-flare`, `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare` and `gpt-image-2`. Sunburst is for detailed work; Flare is for fast iteration. Use env vars `OPENAI_IMAGE_MODEL_DRAFT` (default: the newest Flare) and `OPENAI_IMAGE_MODEL_FINAL` (default: the newest Sunburst). On startup, list the models this key can use, log them, and fail with a clear message if a configured model is missing.
- **Endpoint:** the Image API, `POST /v1/images/edits` (multipart).
  - `image[]`: the room photo first, then the references (swatches, item photo).
  - `mask`: a PNG with an alpha channel, where transparent means "edit here". It must have the same size and format as the first image, and it applies only to the first image.
- **Size:** use custom `WIDTHxHEIGHT` matching the photo's aspect ratio. Both sides must be multiples of 16, the aspect ratio between 1:3 and 3:1, and neither edge over 3840 px. Matching the photo means the result lines up without cropping.
- **Quality:** 2.5 and 2.6 accept `low`, `medium`, `high`, `xhigh`, `max` and `auto`. Defaults: draft = `medium` on Flare, final = `high` on Sunburst. Both are configurable.
- **Streaming:** use `stream` with `partial_images` (0–3) and relay the partials to the browser over SSE. Each partial adds about 100 output tokens.
- **Format:** `jpeg` or `webp` for drafts (faster), `png` for the final.
- `input_fidelity`: don't send it to `gpt-image-2`, which rejects it. Check whether each model accepts it before sending it.
- `safety_identifier`: send a hash of the staff ID (128 characters or fewer). The `user` parameter is deprecated.
- **Organization verification:** OpenAI says you "may need" to verify the organisation before using GPT Image. EUC must finish this before launch.
- **Pricing:** charged per token. Image input is $8 and image output is $30 per 1M tokens. As a guide, a 1024×1024 image on `gpt-image-2` was about $0.053 at medium and about $0.21 at high. Work out the real cost from the token counts in the response and store it.

### 7.2 Prompt builder (server-side only)

- Use one template per action: finish change, item insert, remove, full-room spec, render to photo, generate, final pass.
- Staff text is translated, then inserted as a quoted detail inside the template. It is **never** the whole prompt.
- Every template includes these preservation rules:
  - This is a real photo of the customer's room.
  - Keep the camera angle, perspective, walls, windows, doors, ceiling, floor and every cabinet and appliance exactly as they are.
  - Change only what is described.
  - Match the original lighting and shadows. Use real material textures.
  - No text, logos, watermarks or people.
- Name each reference image in the prompt. Example: "Image 1 is the room. Image 2 is laminate swatch 'Walnut Grove, code 4321'. Apply this exact colour and grain to the marked shutters."
- Unit-test every template.

### 7.3 Paste-back compositor (browser, Web Worker)

- Align the result to the original, blend through the feathered mask, match colour and exposure in the edge band.
- Test: pixel difference outside the mask and feather band = 0.

### 7.4 Drift check (whole-image passes)

- Compare the structure of the input and output: SSIM on downscaled grayscale plus an edge-map comparison. Turn it into a score from 0 to 100.
- Below the threshold, warn: "The AI changed the room's layout." Offer **Try again** and **Keep anyway**.
- Tune the threshold on the test set (section 12).

### 7.5 Reliability

- Timeout after 180 s. Retry once on 429 or 5xx, with backoff.
- Explain errors in plain English, including content-policy refusals.
- Limit each user to 2 AI calls in flight at once.
- Provider interface: `edit()` (streams partials, then the final), `generate()`, `describe()` (vision), `text()`.
- Include a **mock provider** so the UI and all tests run without an API key.

---

## 8. Tech stack

| Area | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite, React Router, Zustand, Dexie (IndexedDB), Canvas 2D / WebGL for masking and compositing, Web Workers for heavy image work |
| Backend | Node 24 LTS + TypeScript, Fastify (or Express 5), zod, the official OpenAI SDK |
| Database | SQLite via better-sqlite3: users, sessions, usage log, catalogue, suggestions, settings. Catalogue swatches stored on a disk volume. |
| Auth | Email + password (argon2 or scrypt), HTTP-only session cookie stored in the DB, 12-hour idle expiry, login rate limit |
| Deploy | Docker Compose (app + Caddy) on Ubuntu 24.04 with 2 GB RAM in India. Automatic HTTPS, long proxy timeout for AI calls, nightly backup of SQLite and catalogue kept 14 days, uptime monitor |
| CI/CD | GitHub Actions: typecheck, tests, build the image, deploy over SSH on a version tag, one-command rollback |
| Tests | Vitest for prompts, mask, compositor, cost and drift; Playwright on desktop 1280×720, iPad and phone sizes, using the mock provider |

---

## 9. UI and design direction

- **Its own identity, not a copy of EUC's website:** a dark pro-studio look (a graphite workspace like Lightroom or Figma), one accent colour (electric lime) and the Geist font. A small "for EUC Technowood" logo chip. No developer credit.
- **Desktop:**
  - Left panel: room and the current step.
  - Centre: a large image with the marking toolbar.
  - Bottom strip: the list of changes and history.
  - Everything fits one screen.
- **Tablet:** large touch targets, pinch to zoom, two-finger pan while marking.
- **Words:** plain English with no AI jargon: "Apply", "Try again", "Keep original", "Final HD".
- **Desktop shortcuts:** B brush, E eraser, V click-select, Ctrl+Z / Ctrl+Shift+Z undo/redo, Space hold to compare.
- **Accessibility:** WCAG AA contrast and visible focus states.

---

## 10. Privacy and security

- Customer photos are never written to disk or to logs on the server. Don't log request bodies.
- Photos are sent to OpenAI to be processed. Write this in the staff guide. Check OpenAI's API data-retention terms and give EUC a one-line note staff can say to customers.
- The API key lives only on the server.
- Validate every request with zod. Set request size limits, security headers and SameSite=Lax cookies.
- Apply per-user rate limits and daily budgets.

---

## 11. Data model

```
users            id, name, email, password_hash, role (admin|designer), daily_budget_inr, active, created_at, last_login_at
sessions         id, user_id, expires_at, created_at
usage_log        id, user_id, created_at, project_label, room_type, action, model, quality, size, variations,
                 input_tokens, output_tokens, cost_inr, latency_ms, status (ok|failed|refused|drift_warning), drift_score, error
catalogue_items  id, category, name, code, swatch_path, prompt_description, room_types (json), active, sort
suggestions      id, part, label, prompt, room_types (json), sort
settings         key, value
```

---

## 12. Quality bar and testing

- **Test set:** EUC provides 20–30 real photos and Cabinet Vision renders. Write a scripted list of changes for them.
- **`npm run eval`:** runs the set through the real API and builds an HTML contact sheet showing, for each case, before, after, drift score, cost and time.
- **Acceptance:**
  - Pixel test: nothing outside the mask changes.
  - EUC staff rate at least 8 out of 10 results "looks real".
  - Every whole-image pass passes the drift check, or shows the warning.
  - A typical draft arrives in 60 s or less.
  - Works in Chrome on desktop, Safari on iPad and Chrome on Android.

---

## 13. Build phases

Each phase ends with a short report of what was done, what was measured and what is open.

| Phase | Work | Done when |
| --- | --- | --- |
| **0. Spike** (1–2 days) | Check the model IDs on EUC's key. Run 5 photos through draft and final settings, recording time and cost. Prove mask + paste-back. | A table of time, cost and quality per setting, and the chosen defaults |
| **1. Core studio** (~1.5 weeks) | Projects in IndexedDB, upload + photo check, brush/corners/eraser, catalogue finish, suggested changes, paste-back, variations, compare, history, download, mock provider | A full Mark & edit session works on desktop and tablet with nothing stored on the server |
| **2. Pro editing** (~1.5 weeks) | Click-to-select, AI help (multilingual), item photo, remove/clean-up, Advanced spec, render to photo, generate, Final HD, drift check, streamed partials | Every action passes the eval set at the agreed quality |
| **3. Accounts and admin** (~1 week) | Login, roles, staff admin, catalogue admin, suggestions admin, settings, usage log, ₹ budgets, dashboard, CSV | An admin can run the studio with no developer |
| **4. Presentation and polish** (~0.5 week) | Branded PDF/image, Web Share, project export/import, keyboard shortcuts, empty and error states | A designer can send a customer a branded result from a tablet |
| **5. Deploy and handover** (~1 week) | Docker, VPS hardening, DNS + HTTPS, backups with a tested restore, uptime monitor, CI/CD, staff test with 2–3 designers, guides, runbook, credentials handed to EUC | Live on EUC's subdomain and EUC holds every account |

---

## 14. Out of scope

3D models, measurements, importing Cabinet Vision files, price quotes, a customer-facing app, multi-company SaaS, payments, storing customer photos on the server, whole-room style presets, video.

## 15. Later ideas (don't build now)

- A before/after video for WhatsApp and Instagram
- Project storage on the server, with customer consent
- Automatic fallback to a second AI provider
- A share link for customers to view their design
- Integration with Cabinet Vision exports

## 16. Deliverables

- `README.md` (setup and running)
- `.env.example`
- `docs/DECISIONS.md`
- `docs/RUNBOOK.md` (deploy, roll back, restore a backup, rotate the API key)
- A one-page staff guide (good photos, marking, Mark & edit vs Advanced, Final HD, sharing)
- An admin guide (staff, budgets, catalogue, reading usage, what to do when the AI fails)

## 17. How to work

- Build the mock provider first, so UI work costs nothing.
- Make small commits and keep tests passing.
- Ask before adding any paid service or a new external dependency that receives customer photos.
- Never put real API keys in code, commits or logs.
