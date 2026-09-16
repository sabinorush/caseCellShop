# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CaseCellShop is a minimal phone-case store built to demonstrate a correct checkout flow: preventing
overselling and preventing duplicate purchases from a double-click/resubmit. Out of scope (per PRD.md):
authentication, a real payment gateway, a persistent database, deployment, elaborate layout, and Docker.
Business rules that must hold:
- Requested quantity can never exceed stock.
- Stock is only decremented on a successful purchase.
- The buy button must not allow duplicate submission while a purchase is processing.

## Monorepo

PNPM workspaces (`apps/*`). Run everything from the repo root using the `--filter` shortcuts already
defined in the root `package.json` — no need to `cd` into a workspace.

- `apps/api` — NestJS (Node.js) REST API, ESM (`"type": "module"`, all relative imports end in `.js`).
- `apps/web` — React 19 + TypeScript + Vite, CSS Modules for styles, Zod for form validation.

## Commands

Run from the repo root:

```
pnpm dev            # both apps in parallel
pnpm dev:api        # API only (nest start --watch)
pnpm dev:web        # web only (vite)
pnpm build          # build both
pnpm test           # unit tests, both apps
pnpm test:api       # API unit tests (vitest run)
pnpm test:api:e2e   # API e2e tests (vitest run --config ./vitest.config.e2e.ts)
pnpm test:web       # web unit tests
pnpm lint           # oxlint, both apps
```

Single test file (run inside the relevant workspace, or via `pnpm --filter <pkg> exec vitest run <path>`):

```
pnpm --filter @casecellshop/api exec vitest run src/checkout/checkout.service.spec.ts
pnpm --filter @casecellshop/web exec vitest run src/api/idempotency.test.ts
```

API test files: `*.spec.ts` (unit, `vitest.config.ts`) vs `*.e2e-spec.ts` (e2e, `vitest.config.e2e.ts`,
lives under `apps/api/test/`) — these are separate Vitest configs/commands, not one glob.

## Environment

Both apps read config via Zod-validated env loading and refuse to start with a clear error message if
config is missing/invalid (see `apps/api/src/config/env.ts` and the `API_URL` check in
`apps/web/vite.config.ts`). Copy `.env.example` to `.env` in each app before running dev/build:

- `apps/api/.env` — `PORT`
- `apps/web/.env` — `API_URL` (target for the `/api` dev-server proxy, rewritten to strip the `/api` prefix)

## Architecture

### API (NestJS, in-memory state)

Feature modules under `apps/api/src/`: `products/`, `checkout/`, `health/`, plus `common/` and `config/`
shared across them. There is no database — `ProductsService` holds product/stock state in memory
(`createInitialProducts()`), so state resets on restart and is per-process (relevant if ever scaled to
multiple instances).

Request validation uses Zod schemas (`checkout.schema.ts`) through a shared `ZodValidationPipe`
(`common/zod-validation.pipe.ts`). `@Headers()` doesn't support pipes as a second argument like
`@Body()`/`@Param()`/`@Query()` do, so the `Idempotency-Key` header is validated manually inside the
controller handler by calling the pipe's `.transform()` directly — see `checkout.controller.ts`.

**Idempotency and overselling prevention** (`checkout.service.ts` + `common/idempotency-store.ts`) is the
core piece of business logic in this repo:
- `CheckoutService.purchase()` derives a fingerprint from `productId:quantity` and calls
  `IdempotencyStore.begin(key, fingerprint)` before doing anything else.
- A brand-new key proceeds; a key already `in-flight` throws 409 (blocks concurrent duplicate submits); a
  completed key with a matching fingerprint replays the stored result instead of reprocessing; a key
  reused with a *different* fingerprint (e.g. same key, different quantity) throws 422.
- On failure, the key is released (not burned) so the same key can be retried — see the comment in
  `purchase()`. On success, the key is completed and its result cached for replay.
- `IdempotencyStore` is a single in-memory `Map` (no Redis) sized for one process, with lazy TTL eviction
  on `begin()` and max-entries eviction on insert — read the class doc comment before changing eviction
  behavior.
- Stock is only decremented inside `ProductsService.decreaseStock()`, which throws
  `InsufficientStockError` (mapped to 409) if `quantity > stock`; this is what enforces "never oversell."

### Web (React + Vite)

- `api/client.ts` centralizes all `fetch` calls, classifies failures into an `ApiErrorKind`
  (`network` / `timeout` / `unavailable` / `http` / `invalid-response`), and exposes `ApiError.retryable`
  so callers know whether to keep the in-flight idempotency key for a retry. Responses are validated with
  Zod (`api/schemas.ts`) before being trusted — an unexpected shape becomes `invalid-response`, not a
  silent bad render. 502/503/504 are treated specially (`unavailable`) since their body is typically not
  API JSON.
- The dev server (`vite.config.ts`) proxies `/api/*` to `API_URL` and, only in dev, synthesizes JSON
  502/504 error bodies on proxy failure so the frontend's error handling can be exercised without a real
  backend outage.
- `api/idempotency.ts` decides whether a purchase attempt should reuse or regenerate its
  `Idempotency-Key`: same `checkoutFingerprint` (`productId:quantity`) as the in-flight attempt → reuse
  the key (so a retry after a *retryable* failure replays instead of double-purchasing); different
  fingerprint or no prior attempt → generate a new key via `crypto.randomUUID()`.
- `components/BuyForm.tsx` is where both business rules meet the UI: it disables the submit button while
  `isSubmitting` (blocks duplicate clicks), and its catch block only clears `attemptRef` when the error is
  *not* an `ApiError` or *not* `retryable` — i.e., a retryable failure deliberately keeps the same attempt
  (and thus the same Idempotency-Key) for the next click, while a definitive failure (4xx/business error)
  starts a fresh attempt.
