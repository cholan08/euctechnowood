# EUC Room Studio: Product Build Plan

Written: 20 Nov 2026. Starting point: the working MVP in this repo (studio, quote leads, admin, xAI + Gemini providers, 74 passing UI checks).

---

## 1. What we are building

**One sentence:** a white-label AI design studio that EUC Technowood sells to furniture and modular-kitchen manufacturers. Their customers upload a room photo (or the manufacturer uploads a Cabinet Vision render), see it redesigned with **that manufacturer's real finishes**, and send a quote request straight to the manufacturer's sales team.

### Who uses it

| User | What they do | Where |
| --- | --- | --- |
| **Homeowner** (end customer) | Upload a room photo, try styles and finishes, save designs, request a quote, share on WhatsApp | Manufacturer's studio page (phone first) |
| **Manufacturer sales team** | Get leads with the design attached, call or WhatsApp them, track status | Manufacturer portal |
| **Manufacturer admin** | Branding, catalogue (laminates, finishes, handles), team members, usage, billing | Manufacturer portal |
| **Cabinet Vision designer** (at the manufacturer) | Turn CV renders into photoreal images for their clients | Manufacturer portal |
| **EUC super-admin** | Onboard manufacturers, set plans and credits, watch usage, AI cost and quality | EUC console |

### How EUC makes money (to confirm with client)

- A monthly plan per manufacturer, with an included number of AI images. Extra images are sold as credit packs.
- It can be bundled as an add-on to Cabinet Vision licences EUC already sells.

---

## 2. Where we are today (the MVP)

**Keep and build on:**
- `shared/catalog.ts`: options and prompt text. This becomes database rows per manufacturer.
- `server/services/prompt.ts`: the prompt builder and guardrails, the core of AI quality.
- `server/providers/*`: one provider interface with xAI (`grok-imagine-image-2.0`), Gemini and mock behind it.
- The UI: landing page, one-screen studio, quote modal, admin leads list, brand tokens.
- The end-to-end UI test, which becomes the Playwright suite.

**Replace or add:**

| MVP shortcut | Production version |
| --- | --- |
| SQLite file | PostgreSQL |
| Images on local disk | Object storage (Cloudflare R2 or S3) with signed URLs |
| One 30–40 s HTTP request per generation | Job queue and worker, with live progress |
| In-memory rate limits | Redis-backed limits and per-account credits |
| One admin password | Accounts with roles, phone OTP for customers |
| One brand, one catalogue | Multi-tenant: branding, catalogue and leads per manufacturer |
| Hand-written validation | `zod` schemas shared by web and API |

---

## 3. Target architecture

```
                 ┌────────────── Cloudflare (DNS, CDN, R2 image storage) ──────────────┐
 Homeowner ──►  web (React SPA)  ──►  api (Express + zod)  ──►  PostgreSQL
 Staff     ──►  portal routes          │        ▲
                                       ▼        │ status / progress (SSE)
                                   Redis queue (BullMQ)
                                       │
                                       ▼
                                  worker ──► AI providers (xAI, Gemini, …)
                                       └──► R2 (save images) ──► WhatsApp / email alerts
```

### Stack decisions

Each choice keeps what already works and adds only what the product needs.

| Area | Choice | Why |
| --- | --- | --- |
| Repo | pnpm workspaces monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/db` | Web, API and worker share types, catalogue and prompt code |
| Frontend | React + Vite + React Router (as now), plus TanStack Query | Already built and tested; Query handles loading and caching |
| API | Express 5 + TypeScript + zod | Already in use; zod replaces hand-written checks |
| Database | PostgreSQL 16 + Drizzle ORM + migrations | Relational data (tenants, leads, credits); typed queries |
| Queue | Redis + BullMQ | AI calls take 15–40 s; we need retries, concurrency limits (xAI image model: 6 req/s, 300/min) and progress |
| Images | Cloudflare R2 (S3 API), signed URLs | Cheap storage, no egress fees; private by default |
| Customer login | Phone OTP over WhatsApp (Meta Cloud API); SMS via MSG91 as fallback | Indian homeowners expect phone login. SMS in India needs DLT template registration, which takes days, so start it early |
| Staff login | Email + password (argon2) with optional OTP; roles per tenant | Simple and secure |
| Payments | Razorpay subscriptions + GST invoices | Indian billing standard |
| Notifications | WhatsApp templates for new leads; email via Resend or SES | Sales teams live on WhatsApp |
| Hosting | Docker Compose on one VPS in India (AWS Mumbai or DigitalOcean Bangalore): api, worker, Postgres, Redis. Daily DB backups to R2 | Low latency for Indian users; data stays in India; cheap to start |
| Monitoring | Sentry (errors), structured logs, uptime check, a cost-per-image dashboard | AI cost is the main running cost |
| Tests | Vitest (unit), Playwright (port of our 74-check UI test), CI on GitHub Actions | Catch regressions before each deploy |

---

## 4. Data model (first version)

```
tenants            id, name, slug, custom_domain, branding (logo, colours), plan_id, status
users              id, tenant_id, role (customer | staff | tenant_admin | euc_admin), name, phone, email, password_hash
projects           id, tenant_id, customer_id, room_type, source (photo | render), original_image_key, created_at
generations        id, project_id, parent_id (for "refine" chains), style_id, options (json), prompt,
                   provider, model, status (queued | running | done | failed), error,
                   output_image_key, cost_paise, latency_ms, created_at
catalogue_groups   id, tenant_id, key (wall | shutters | countertop | flooring | ceiling | handles), label, sort
catalogue_items    id, group_id, name, swatch_hex, swatch_image_key, prompt_text, active, sort
styles             id, tenant_id (null = EUC default), name, blurb, prompt_text, active, sort
leads              id, tenant_id, project_id, generation_id, customer_id, name, phone, email, city, message,
                   status (new | contacted | site_visit | quoted | won | lost), assigned_to, source
lead_events        id, lead_id, user_id, type (note | status | call | whatsapp), body, created_at
credit_ledger      id, tenant_id, generation_id, delta, reason (plan | purchase | generation | refund), created_at
subscriptions      id, tenant_id, razorpay_id, plan_id, status, renews_at
consents           id, user_id, purpose, granted_at, withdrawn_at
audit_log          id, tenant_id, user_id, action, target, created_at
```

Every tenant-owned table has `tenant_id`, and every query filters by it. A shared helper enforces this so one manufacturer can never see another's data.

---

## 5. Phases

Estimates assume **one full-time developer** (with AI assistance). Phases 1 and 2 can overlap.

### Phase 0: Foundations (week 1–2)

Goal: same features as the MVP, on production-grade plumbing.

- [ ] Restructure into the monorepo; move catalogue, prompt and types into `packages/shared`
- [ ] PostgreSQL + Drizzle schema + migrations; seed default styles and catalogue from `shared/catalog.ts`
- [ ] R2 storage with signed upload and download URLs
- [ ] zod validation on every endpoint
- [ ] Docker Compose (api, worker, postgres, redis) for local and server
- [ ] CI: typecheck, lint, unit tests, Playwright suite
- [ ] Staging server with HTTPS; Sentry; daily backups

**Done when:** the current demo flow works on staging and CI is green.

### Phase 1: AI quality and the generation pipeline (week 2–4)

Goal: designs that are reliable enough to sell, at a known cost.

- [ ] **Test set:** 50 real customer photos and 10 Cabinet Vision renders (kitchens, halls, bedrooms; good and bad light)
- [ ] **Scoring sheet:** for each image, rate 1–5 on structure kept (walls, windows, doors), changes applied, realism and render-layout kept
- [ ] Run the set through xAI `grok-imagine-image-2.0`, Gemini and one more model; pick a default and a fallback
- [ ] Harden prompts:
  - **Render mode:** styles change materials and colours only, never layout. This is a known issue today: Japandi moved the island and added a window.
  - **Room types:** add rules per room type.
- [ ] Queue + worker: retries with backoff, provider fallback, a concurrency limit, a cancel option
- [ ] Live progress in the UI (Server-Sent Events) instead of one long request
- [ ] Record cost, time and outcome per generation; weekly quality report
- [ ] Upload checks: file type, size, minimum resolution, basic content moderation

**Done when:** at least 80% of the test set scores 4+ on "structure kept", and the cost per image is known.

### Phase 2: Customer accounts and projects (week 4–6)

- [ ] Phone OTP login (WhatsApp first, SMS fallback); start **DLT registration in week 1**
- [ ] Projects: each room keeps its photo, all designs and the refine history
- [ ] "My designs" page; rename and delete projects
- [ ] Share a design by link and to WhatsApp, with an image preview
- [ ] Quote request tied to the account (no retyping); confirmation on WhatsApp
- [ ] Credits per customer per day, so one visitor can't run up the bill
- [ ] Consent at sign-up; "delete my data" (DPDP Act 2023)

**Done when:** a customer can log in on a phone, come back tomorrow and find their designs.

### Phase 3: Manufacturer portal / multi-tenant (week 6–10)

- [ ] Tenants: subdomain per manufacturer (`brand.roomstudio.in`), optional custom domain
- [ ] Branding: logo, colours, studio headline; the studio themes itself per tenant
- [ ] **Leads CRM:**
  - list, filters, detail page with before/after
  - status pipeline (new → contacted → site visit → quoted → won/lost), notes, assign to a salesperson
  - WhatsApp and email alert on each new lead; CSV export
- [ ] Team: invite staff, roles (admin, sales, designer)
- [ ] **Catalogue manager:** add finishes per group with name, colour or swatch photo, and the prompt text; reorder; enable or disable
- [ ] Styles: use EUC defaults or customise
- [ ] Cabinet Vision area for designers: upload a render, get photoreal output, download in high resolution
- [ ] Dashboard: designs made, leads, conversion, credits left

**Done when:** two pilot manufacturers each have their own branded studio, catalogue and leads, fully separated.

### Phase 4: Real products in the image (week 10–12)

- [ ] **Swatch-guided edits:** send the finish's swatch photo along with the room photo, so the laminate in the design matches the real product. xAI's edit endpoint accepts up to 3 images, so check this against the test set.
- [ ] **Tap to edit:** customer taps the wall, cabinet or floor; only that area changes (segmentation mask + masked edit)
- [ ] Higher-resolution download for paying tenants

**Done when:** a manufacturer agrees "that is our laminate" on most test designs.

### Phase 5: Billing and EUC console (week 12–14)

- [ ] Plans with included images per month; credit packs; Razorpay subscriptions; GST invoices
- [ ] Usage metering from `credit_ledger`; soft and hard limits; low-credit alerts
- [ ] EUC console: create and suspend tenants, set plans, grant credits, view usage, AI cost, margin and quality per tenant

### Phase 6: Launch hardening (week 14–16)

- [ ] Security review (auth, tenant isolation, file uploads, rate limits); fix findings
- [ ] Load test: 50 parallel generations; queue behaves, no timeouts
- [ ] DPDP: privacy policy, terms, consent records, retention (for example, delete unclaimed photos after 90 days)
- [ ] Backups restore-tested; runbook for outages and provider failures
- [ ] Landing page SEO, analytics, PWA install on phones
- [ ] Pilot with 2–3 manufacturers; fix what they hit; then launch

### Later (after launch)

- **Embed widget:** one script tag puts the studio on a manufacturer's own website.
- **Cabinet Vision link:** a desktop helper that watches CV's render export folder and uploads automatically.
- Hindi and Tamil UI.
- A short walkthrough video of the design (xAI also has a video model).
- A rough price estimate from the chosen finishes and room size.

---

## 6. Timeline at a glance

| Weeks | 1–2 | 3–4 | 5–6 | 7–8 | 9–10 | 11–12 | 13–14 | 15–16 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Foundations | ██ | | | | | | | |
| 1 AI quality + queue | █ | ██ | | | | | | |
| 2 Accounts + projects | | █ | ██ | | | | | |
| 3 Manufacturer portal | | | █ | ██ | ██ | | | |
| 4 Real products | | | | | █ | ██ | | |
| 5 Billing + EUC console | | | | | | █ | ██ | |
| 6 Hardening + pilot | | | | | | | █ | ██ |

About **16 weeks** to a paid pilot with one developer; about 10 weeks with two.

---

## 7. Running costs to measure (Phase 1)

- **AI images** are the main cost, billed per generated image (and per input image on some models). Read the current prices in the xAI and Google consoles, and store the real cost of every generation in `generations.cost_paise`.
- **Fixed costs:** VPS, R2 storage, WhatsApp template messages (charged per conversation), SMS OTPs, Sentry. These stay small until there are many tenants.
- **Pricing rule of thumb:** set each plan's included images so AI cost stays under about 30% of the plan price.

---

## 8. Risks and how we handle them

| Risk | Mitigation |
| --- | --- |
| AI changes the room structure or the CV layout | Phase 1 test set + scoring before launch; stricter render prompts; tap-to-edit later |
| One AI provider fails, gets slower or changes price | Provider interface already supports several; automatic fallback in the worker |
| AI cost runs away | Credits per customer and per tenant; queue concurrency limit; cost dashboard |
| One tenant sees another's data | `tenant_id` on every row, a shared query helper, tests for isolation |
| SMS OTP blocked by DLT rules | Start registration in week 1; WhatsApp OTP first |
| Customers upload unsuitable images | Upload checks + provider moderation; report button |
| Personal data (home photos, phone numbers) | DPDP consent, deletion, retention limits, data hosted in India, signed URLs |
| Customers expect exact sizes or prices | Clear "concept image, not to scale, not a quote" labels everywhere |

---

## 9. Decisions needed from EUC (before Phase 3)

1. **Who is the customer?** White-label for manufacturers (this plan), EUC's own lead tool, or both?
2. **Pricing:** monthly plan per manufacturer, credits, or bundled with Cabinet Vision?
3. **Pilot manufacturers:** which 2–3 (for example from their client list) and when?
4. **Domain:** product name and domain (for example `roomstudio.in` with subdomains).
5. **Brand on the studio:** manufacturer's brand only, or "Powered by EUC Technowood" too?
6. **Catalogue data:** can pilot manufacturers supply finish names and swatch photos?
7. **Data retention:** how long to keep customer photos and designs?

---

## 10. This week

1. Share this plan with EUC and get answers to section 9 (at least 1, 3 and 4).
2. Commit the current MVP and tag it `v0.1-demo`.
3. Start collecting the 50-photo test set.
4. Begin Phase 0: monorepo, Postgres, R2, CI.
5. Start WhatsApp Business API and DLT registration (they take time).
