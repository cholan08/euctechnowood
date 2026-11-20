# EUC Room Studio: Build and Deployment Plan

Updated: 20 Nov 2026. Starting point: the working MVP in this repo (one-screen studio, xAI + Gemini providers, 74 passing UI checks).

---

## 1. What we are building

An **internal design tool for EUC Technowood's staff**. During EUC's paid design process (the customer pays a design amount before the project starts), a staff member uploads the customer's room photo or a Cabinet Vision render. They try styles and finishes, compare before and after, and **download** the designs to share with the customer.

**Scope decisions (agreed):**

| Topic | Decision |
| --- | --- |
| Users | EUC staff only, behind a login. No public access. |
| Billing | None in the app. EUC charges the design amount in their own process. |
| Quote form / leads | Removed. Staff already know the customer. |
| Images | **Not stored.** Image → AI → shown in the browser → downloaded. Nothing saved on the server. |
| Database | Small: staff logins + a usage log (who made how many designs, when, AI cost). No images. |
| Clients | One: EUC, on their own domain (for example `studio.<euc-domain>`). |
| Hosting | One small VPS in India, running the frontend, backend and database together. |

**What "no image storage" means for staff:** designs live only in the open browser tab. Closing or refreshing the page loses anything not downloaded. The studio warns before leaving with undownloaded designs.

---

## 2. What changes from the MVP

| Keep as is | Remove | Add |
| --- | --- | --- |
| Studio UI (one screen, tabs, compare slider, thumbnails) | "Get a quote" form, leads admin, CSV of leads | Staff login with personal accounts |
| `server/services/prompt.ts` and guardrails | `designs` / `leads` tables | Admin: manage staff, view usage and AI cost |
| xAI + Gemini providers, mock mode | Saving images to disk, `/uploads` | Usage log per generation |
| Brand styling, landing slider | Public landing page as a homepage (becomes the login page) | Per-user daily image limit |
| UI test suite | | Deployment: Docker, HTTPS, backups |

---

## 3. Architecture

```
 Staff browser ──HTTPS──► Caddy (auto HTTPS, studio.<euc-domain>)
                              │
                              ▼
                     Node app (one container)
                     ├─ serves the React app
                     ├─ /api/auth   login, logout, session
                     ├─ /api/redesign  ──► xAI grok-imagine-image-2.0 (Gemini as fallback)
                     │                   image returned to the browser, never saved
                     ├─ /api/admin  staff and usage
                     └─ SQLite file (users, sessions, usage log) on a Docker volume
                              │
                              └─ nightly backup of the SQLite file to off-server storage
```

### Stack

| Area | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite + React Router (as now) | Already built and tested |
| Backend | Node 22 + Express 5 + TypeScript, plus `zod` for request checks | Already in use |
| Database | SQLite via `better-sqlite3` (stable driver, replaces the experimental `node:sqlite`) | A few staff and one usage row per design: SQLite is plenty, and there's no DB server to run |
| Passwords | `scrypt` from Node's `crypto` (no native add-on needed) | Secure hashing with no extra dependency |
| Sessions | Random session ID in an HTTP-only cookie, stored in the DB (logout works everywhere) | Simple and revocable |
| Web server | Caddy in front of Node | Automatic HTTPS certificates; long timeout for 30–60 s AI calls |
| Packaging | Docker Compose: `app` + `caddy` | One command to deploy or roll back |
| CI/CD | GitHub Actions: typecheck, tests, build image; deploy over SSH on a tag | Repeatable releases |

**No job queue is needed.** A few staff generating designs is well inside xAI's limit (6 requests/second for the image model), so the request simply waits for the AI, as it does now.

---

## 4. Data model

```
users       id, name, email, password_hash, role (admin | staff), daily_limit, active, created_at, last_login_at
sessions    id (random), user_id, expires_at, created_at
usage_log   id, user_id, created_at, customer_label (optional, typed by staff),
            room_type, source (photo | render), style, options (json: finishes, extras, note),
            provider, model, status (ok | failed | blocked), error, latency_ms, est_cost_paise
```

`customer_label` is an optional "Customer / project" field in the studio bar. It lets EUC match AI usage to the design amount they charged, without storing any images.

---

## 5. Phases

Estimates are for **one developer**.

### Phase 1: Trim to scope (2–3 days)

- [ ] Remove the quote modal, leads routes, leads admin, `designs` / `leads` tables, image saving and `/uploads`
- [ ] `/api/redesign` returns each design as a data URL; Download and Refine work from that
- [ ] "Leave page?" warning when there are designs not yet downloaded
- [ ] **Download all**: save every design in one click
- [ ] Switch to `better-sqlite3`; add `zod` validation
- [ ] Update the UI test suite to the new flow

**Done when:** the full studio flow works and nothing is written to disk except the database.

### Phase 2: Staff accounts and usage (3–4 days)

- [ ] Login page (reuses the branded hero); all studio and API routes require login
- [ ] Roles: **admin** (manages staff, sees usage) and **staff** (uses the studio)
- [ ] First admin created by a command on the server: `npm run create-admin`
- [ ] Admin pages:
  - **Staff:** add, deactivate, reset password, set daily limit
  - **Usage:** designs per day, month and person, failures, estimated AI cost, CSV export
- [ ] Usage row written for every generation (success or failure)
- [ ] Per-user daily image limit, with a clear message when it's reached
- [ ] Login rate limiting; sessions expire after 12 hours idle

### Phase 3: Design quality and staff workflow (3–5 days)

- [ ] **Test set:** 20–30 real EUC photos and Cabinet Vision renders; score structure kept, changes applied and realism
- [ ] **Render mode fix:** styles change only materials, colours and lighting, never the cabinet layout. Known issue: Japandi moved the island and added a window.
- [ ] Notes box: hint ("people, text and logos are not added") and tap-to-add example prompts
- [ ] Optional "Customer / project" field in the studio bar, saved to the usage log
- [ ] **Presentation download:** a before/after image with the EUC logo, style name and date, generated in the browser and ready to send to the customer
- [ ] Retry button on a failed design; automatic fallback to Gemini if xAI fails (needs a Gemini key)

### Phase 4: Deployment (2–3 days)

- [ ] `Dockerfile` (multi-stage: build, then a small runtime image) and `docker-compose.yml` (app + caddy)
- [ ] VPS in India (DigitalOcean Bangalore or AWS Lightsail Mumbai, 1–2 GB RAM, Ubuntu 24.04), **in EUC's own cloud account**
- [ ] Server hardening: SSH keys only, firewall (ports 22, 80, 443), automatic security updates, non-root deploy user
- [ ] DNS: `A` record `studio.<euc-domain>` → server IP; Caddy issues the HTTPS certificate
- [ ] Secrets in a server-only `.env`: `XAI_API_KEY`, `SESSION_SECRET`, optional `GEMINI_API_KEY`
- [ ] Nightly SQLite backup kept for 14 days, plus a weekly server snapshot; **test a restore once**
- [ ] Uptime monitor (for example UptimeRobot) with email or WhatsApp alerts
- [ ] GitHub Actions: on a version tag, build, push the image, SSH deploy, health check; one-command rollback

### Phase 5: Handover (1–2 days)

- [ ] Staging check with 2–3 EUC staff on real customer photos; fix what they find
- [ ] One-page staff guide: good photos, styles vs notes, refine, download
- [ ] Admin guide: adding staff, reading usage, what to do if the AI fails
- [ ] Runbook: deploy, roll back, restore backup, rotate the AI key
- [ ] Hand over all accounts and credentials to EUC (VPS, xAI, domain DNS, GitHub)

---

## 6. Timeline

| Week | Work |
| --- | --- |
| Week 1 | Phase 1 (trim) + Phase 2 (accounts and usage) |
| Week 2 | Phase 3 (quality and workflow) + start Phase 4 (server, DNS, Docker) |
| Week 3 | Finish deployment, staging check with EUC staff, handover |

**About 3 weeks** to go live.

---

## 7. Running costs (EUC pays directly)

| Item | Cost |
| --- | --- |
| VPS in India | About ₹500–1,000 / month |
| Domain | Already owned by EUC |
| HTTPS certificate | Free (Caddy / Let's Encrypt) |
| AI images (xAI) | Per image. Read the current price in the xAI console and set a **monthly spending limit** there; the usage page shows the running estimate |
| Backups | Small (a few MB of database) |

EUC's xAI account and billing should be **in EUC's name**, so AI cost goes straight to them and can be included in the design amount.

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| AI changes the room or the cabinet layout | Test set + render prompt fix in Phase 3; staff can refine or regenerate |
| Staff lose designs on refresh (nothing stored) | "Leave page?" warning, Download all, presentation download |
| AI provider down or slow | Gemini fallback; clear error with Retry |
| Unexpected AI bill | Per-user daily limit, spending cap in the xAI console, usage page |
| Customer photos leave EUC | Photos are not stored by us, but they are sent to xAI for processing. Tell EUC this and review xAI's data-retention terms |
| Server problem | Nightly backups, weekly snapshot, uptime alerts, runbook, rollback |

---

## 9. Needed from EUC

1. **Subdomain** to use (for example `studio.<their-domain>`) and access to edit their DNS.
2. **Cloud account** for the VPS, in EUC's name (or approval to create one).
3. **xAI account** in EUC's name, with billing and a spending limit (or approval to move the current key).
4. **Staff list:** names and emails, and who is admin.
5. **Daily image limit** per staff member (suggested starting point: 30).
6. **20–30 sample photos and renders** for the quality test.

---

## 10. Next steps

1. Commit the current demo as `v0.1-demo`.
2. Start Phase 1 (trim to scope).
3. Send section 9 to EUC so the accounts and DNS are ready by week 2.
