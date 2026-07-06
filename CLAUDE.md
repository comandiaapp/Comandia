# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Comandia — a multi-tenant restaurant POS SaaS. Local-first: the frontend works offline against a local SQLite (sql.js/WASM) copy and syncs to PostgreSQL (Railway) when connectivity returns. All UI text, code comments, variable/function names, and API messages are in **Spanish** — keep new code consistent with this.

## Commands

Root (`package.json`) — used by the Railway/Docker build:
```bash
npm run build         # builds frontend (cd frontend && npm install && npm run build)
npm start              # runs backend (cd backend && node server.js)
npm run dev:backend    # cd backend && npm run dev
npm run dev:frontend   # cd frontend && npm run dev
```

Backend (from `backend/`):
```bash
npm run dev       # node --watch server.js (dev server, port from .env, default 4000)
npm run db:init   # applies src/config/schema.sql + idempotent migrations, then seeds demo data
```

Frontend (from `frontend/`):
```bash
npm run dev        # Vite dev server (default port 5173)
npm run build       # vite build -> frontend/dist (served by backend in production)
npm run tauri:dev   # desktop app (Tauri) dev mode
npm run tauri:build # desktop app build
```

There is no test suite and no linter configured in either package — don't assume `npm test`/`npm run lint` exist.

Each package needs its own `.env` (copy from `.env.example` in `backend/` and `frontend/`). Key backend vars: `DATABASE_URL`, `JWT_SECRET`, `BREVO_API_KEY` (transactional email via Brevo's HTTP API, not SMTP — Railway blocks SMTP), `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` (Mercado Pago). Frontend: `VITE_API_URL`.

## Architecture

### Backend (`backend/src`) — layered Express REST API

`server.js` → `routes/index.js` mounts one router per resource under `/api`. Each resource follows **routes → controllers → models**:
- `routes/*.js`: declares endpoints, applies `verificarToken` (JWT) and `verificarRol(...roles)` middleware (`middlewares/auth.js`). Route ordering matters — literal paths (e.g. `/pedidos/mesa/:mesaId`) must be declared before generic `/pedidos/:id`.
- `controllers/*.js`: request validation, calls model functions, shapes the response via `utils/respuestas.js` (`ok(res, datos, status)` / `error(res, mensaje, status)` — every API response is `{ ok, datos }` or `{ error, mensaje }`).
- `models/*.js`: all SQL (raw `pg` queries, no ORM). Multi-step writes use `pool.connect()` + explicit `BEGIN`/`COMMIT` transactions (see `pedidoModel.js`). Domain errors are thrown as custom `Error` subclasses with a marker field (e.g. `PedidoNoEditableError.pedidoNoEditable`, `MontoInsuficienteError.montoInsuficiente`) that the controller checks to pick the right HTTP status.

**Multi-tenancy**: every table (except join tables) carries `restaurante_id`; every model query filters by it. The JWT payload carries `userId`, `restauranteId`, `sucursalId`, `rol`; `verificarToken` puts these on `req.usuario`. Never trust a `restaurante_id` from the request body for scoping — always use `req.usuario.restauranteId`.

**Database schema** (`backend/src/config/schema.sql`): one file, additive only. New tables use `CREATE TABLE IF NOT EXISTS`; changes to existing tables are appended at the bottom as idempotent `ALTER TABLE ... IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` pairs, each with a comment explaining why. `initDB.js` runs the whole file split on `;` plus one-off migrations that `IF NOT EXISTS` can't express (e.g. `RENAME COLUMN`), then seeds a demo restaurant. Follow this pattern for any schema change — don't restructure schema.sql into a migrations directory.

IDs are UUIDv4 generated in Node (`uuid` package), never Postgres `gen_random_uuid()`, so the same ID generation works against the offline SQLite copy.

Key domain flow: a `pedido` (order) moves through `abierto → enviado_cocina → listo → cuenta_pedida → pagado` (or `cancelado`); a unique partial index enforces one active order per `mesa` (table). Cobrar (checkout) triggers side effects in the background (not awaited, errors only logged) — inventory stock deduction, an automatic `contaduria` (accounting) transaction, and invoice generation — so a failure in any of those never blocks the payment response.

### Frontend (`frontend/src`) — React + Vite, offline-first via an axios interceptor

- `context/`: `AuthContext` (JWT/session), `ConnectivityContext` (online/offline state, triggers sync), `ThemeContext`.
- `db/database.js`: `localDb` — a sql.js (WASM SQLite) instance persisted to IndexedDB via `localforage`. Holds `*_cache` tables (mirrors of server data: productos, categorias, mesas, areas), `pedidos_local`/`pedido_items_local`, a `sync_queue` (pending writes), and an `id_map` (local UUID → server UUID, since IDs created offline need remapping once synced).
- `db/syncService.js`: on reconnect, replays `sync_queue` in insertion order against the real API, then refreshes the `*_cache` tables.
- `utils/apiOffline.js`: `resolverOffline` — a mini request router that answers cacheable GETs and re-implements the write endpoints (mirroring backend logic, e.g. `recalcularPedidoLocal` mirrors `pedidoModel.recalcularTotales`) directly against `localDb` when the network is down; `mirrorRespuestaExitosa` writes successful online responses back into the local cache so mid-shift disconnects have local data to fall back on.
- `utils/api.js`: the axios instance. Response interceptor calls `mirrorRespuestaExitosa` on every success, and on a network error (no `error.response`) calls `resolverOffline` and — if it can resolve — returns a synthetic 200 response shaped like the real API (`{ data: { ok: true, datos } }`) so callers don't need to know they're offline. A real 401 only redirects to `/login` if a token was present (avoids a redirect loop for background syncs that run before login).

When adding a new backend endpoint that must work offline, you generally need to touch three frontend places in tandem: the offline handler in `apiOffline.js` (`RUTAS`), the mirror rule in `RUTAS_MIRROR` (same file), and the replay logic in `syncService.js`'s `procesarItem`.

### Deployment

Single Railway service built from the root `Dockerfile`: installs both `frontend/` and `backend/` deps, builds the frontend, then runs `node backend/server.js`. In production the backend also serves `frontend/dist` as static files and falls back to `index.html` for client-side routing (see the `NODE_ENV === 'production'` block in `server.js`). `railway.json` points at the Dockerfile and configures `/health` as the healthcheck path.
