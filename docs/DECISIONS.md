# Decisions

Choices made while building, with the reason. Newest first. Change a decision by adding a new entry, not by editing an old one.

## 25 Nov 2026: core features for the production studio

The client asked for four groups of features: AI interior generation, AI interior editing, design variations, and studio
management with authentication.

| Decision | Why |
| --- | --- |
| **Customer photos and designs are stored on the server** (database records + image files in `DATA_DIR`). This replaces "images are never stored" in `PLAN.md` and section 2 of `PRODUCTION_BUILD_PROMPT.md`. | The client chose it: image history, saved designs and shared client projects need the images where the whole team can open them. EUC should tell customers their photos are kept and sent to the AI service. |
| **EUC only, not multi-company.** "Team access" = staff accounts with roles. | Confirmed by the client. |
| **Roles: admin, designer, viewer.** Everyone sees every client and project; changing a project needs admin, its owner, or a member given edit access. Viewers never change anything or use the AI. | One small studio: hiding projects from colleagues slows them down; edit rights stop accidental changes. |
| **Styles (Modern, Luxury, Minimalist, Industrial, Scandinavian, Contemporary Indian, Classic) are starting points, not whole-room restyles.** A style is a set of colour/material combinations that fill the per-part spec; staff customise any part, and parts they do not include stay exactly as in the photo. | The client: "don't change anything the client didn't ask for; more customisation, but the real design won't change". The old whole-room "Japandi" preset moved the island and added a window. |
| **Generate (empty room → concepts)** keeps walls, windows, doors, ceiling and camera in every prompt; each concept is one colour combination. Furnished rooms use Standard → "Start from a style", which fills only the ticked parts. | Generation without moving the architecture; furnished rooms keep their real design. |
| **Remove / Add object** are Mark & edit actions, so they also go through paste-back: only the marked area changes. | Same guarantee as every other marked change. |
| **Presentation board is drawn in the browser** (canvas → JPEG) and can be saved to the room's history. | No server-side image library; the board uses the same stored images. |
| **Database: `node:sqlite`** (built into Node 22.13+), not `better-sqlite3`. | No native add-on to compile on the server or in Docker. It prints an "experimental" warning; the API used (`DatabaseSync`, `prepare`, `exec`) is stable in practice. Switch if Node changes it. |
| **Sessions: random token in an HTTP-only, SameSite=Lax cookie; only its SHA-256 is stored.** 12 h idle timeout; login is limited to 10 *failed* attempts per 15 min per address and per email. | A leaked database backup cannot be used to sign in; a busy office is never locked out by successful sign-ins. |
| **Daily image limit per person** (default `DAILY_IMAGE_LIMIT`, per-person override by admins), counted in India time from successful calls only. | Cost control without charging staff for AI failures. |
| **Furniture recommendations** use the text model with the brief (any language), and fall back to a built-in list per room type and style. | Works in mock mode and when the AI is down. |
