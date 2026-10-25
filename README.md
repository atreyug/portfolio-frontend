# Meridian — Privacy-First AI Portfolio Intelligence

A production-quality React + TypeScript frontend for an AI portfolio-intelligence platform
backed by a FastAPI service. It analyzes stock portfolios and mutual funds, projects SIP
outcomes, runs monitoring checks, and surfaces generated alerts — while keeping raw portfolio
data out of persistent storage. Holdings can be typed in directly **or imported from Excel
entirely in the browser** — the workbook is never uploaded; only normalized JSON for one
selected client is sent to the API.

## Tech stack

- **React 19 + Vite + TypeScript** (strict mode)
- **Tailwind CSS v4** for styling
- **React Router (HashRouter)** for navigation
- **Axios** with interceptors for the FastAPI integration
- **Recharts** for data visualization
- **Lucide React** for icons

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Point the app at your FastAPI backend
cp .env.example .env
# then edit .env:
# VITE_API_BASE_URL=http://localhost:8000

# 3. Run the dev server
npm run dev

# 4. Production build
npm run build
```

### Tests

A Vitest suite covers Excel header aliasing, column mapping (no double-mapping), client-id
extraction/filtering, missing optional columns, invalid-row errors, date/number parsing,
derived values, projection-specific validation matrices, monitoring validation, and that
payload builders emit only canonical keys (round-trip JSON checks):

```bash
npx vitest run
```

If `VITE_API_BASE_URL` is unset, the app defaults to `http://localhost:8000`.

> The backend must enable CORS for the origin this app is served from.

## Canonical data schema

The same field contract is enforced across manual forms, Excel column mapping, TypeScript
types (`src/types/api.ts`), frontend validation (`src/utils/validate.ts`) and every outgoing
payload (`src/utils/portfolio.ts`, whitelisted builders):

| Workflow | Required | Optional |
| --- | --- | --- |
| Stock holdings | `client_id`, `symbol`, `quantity`, `buy_price` | `security_name`, `isin`, `exchange`, `buy_date`, `current_price` |
| Mutual fund holdings | `client_id`, `scheme_name`, `units` | `scheme_code`, `folio_no`, `invested_value`, `current_nav`, `current_value`, `investment_date`, `xirr_pct` |
| MF projections | `projection_type` (`FUTURE_VALUE` / `REQUIRED_SIP` / `TIME_TO_TARGET` / `LUMPSUM_GROWTH`) + per-type required inputs | `target_amount`, `monthly_sip_amount`, `current_investment`, `duration_months`, `expected_return_pct` (per-type matrix in `PROJECTION_REQUIREMENTS`) |
| Monitoring check | `client_id`, `symbol` | `quantity`, `buy_price`, `exchange` |

Rules applied everywhere:

- **Missing optional columns never reject a record** — blank cells are treated as absent.
- Required fields and malformed values produce **row-level errors** (shown per spreadsheet
  row number or per form field); invalid rows are skipped, not fatal.
- **Derived values are computed, not demanded**: MF `current_value` is derived from
  `units × current_nav` when absent (flagged as derived); invested value, current value,
  P&L and return % are computed for previews whenever inputs suffice.

## Privacy-first Excel intake

Flow (see `src/components/import/ExcelImportDialog.tsx` and `src/utils/excel.ts`):

1. User drops an `.xlsx` / `.xls` / `.csv` file. It is parsed **locally** with SheetJS
   (dynamically imported). No network call happens during parsing.
2. Column headers are auto-mapped to canonical keys via an alias dictionary
   (`guessColumnMapping`) and can be adjusted manually.
3. The user selects **one `client_id`** — either picked from the unique client IDs found in
   the sheet or a single ID applied to all rows. Only that client's rows are extracted.
4. Rows are validated with clear row-level errors; only valid rows are imported into the
   editable grid.
5. The request sent by the existing analysis buttons is built with
   `buildStockAnalyzeRequest` / `buildMutualFundAnalyzeRequest`, which prune each holding
   through explicit key whitelists (`STOCK_HOLDING_KEYS`, `MF_HOLDING_KEYS`). **The original
   Excel file is never transmitted**, and no column outside the canonical schema can leak.

The dialog is mounted conditionally: closing it drops the ArrayBuffer, workbook and parsed
rows from memory. Nothing is written to storage or logged.

## Backend integration contract

All requests go through the centralized client (`src/services/client.ts`), which:

- attaches `Authorization: Bearer <access-token>` to non-auth requests,
- single-flight refreshes the access token via `POST /auth/refresh` on HTTP 401 and replays
  the original request,
- clears the session and notifies the user when refresh fails,
- normalizes FastAPI errors (`detail` string / 422 validation arrays) into readable messages.

### Endpoints used

| Area | Method & path |
| --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/login` (falls back to alias `POST /auth`), `POST /auth/refresh` |
| Profile | `GET/PUT/DELETE /managers/me`, `PUT /managers/me/password` |
| Analysis | `POST /api/portfolio/analyze`, `POST /api/portfolio/mutual-fund/analyze`, `POST /api/portfolio/mutual-fund/analyze-portfolio` |
| Monitoring | `POST /api/monitoring/check`, `POST /api/monitoring/run` |
| Alerts | `GET /api/alerts?unread_only=`, `PATCH /api/alerts/{alert_id}/read` |

### Request-payload assumptions

Request bodies follow the documented field names (`client_id`, `symbol`, `quantity`,
`buy_price`, `scheme_name`, `units`, projection inputs, etc.). Where the spec left the exact
envelope open, the app sends a pragmatic superset that Pydantic's default (ignore-extra)
parsing accepts:

- login sends `{ email, username, password }` (covers both field namings),
- signup sends `{ email, password, full_name?, name? }`,
- analysis endpoints receive `{ client_id, currency, holdings: [...] }`,
- password change sends `{ current_password, old_password, new_password }`,
- account deletion sends `{ password }` in the body only when the user provides one.

### Response handling

Response schemas are **not assumed**. Results pass through a tolerant renderer
(`src/components/ResultView.tsx`) that inspects each payload and displays only what exists:
scalars become metric tiles (currency/percent/date aware), arrays of objects become tables,
string arrays become insight/risk/news lists, long text becomes an AI-narrative card, and a
"View raw response" toggle always shows the verbatim JSON. Dashboard metrics are extracted
from actual analysis responses; missing values render as `—` and are never fabricated.

## Privacy-first behavior

- Raw holdings, folio numbers and analysis payloads are kept **in application memory only**
  (React state) — never in `localStorage`, `sessionStorage`, IndexedDB, URLs, or analytics.
- Session data is wiped on logout and when the tab closes.
- The access token is held in memory. **Limitation:** because the backend returns bearer
  tokens rather than an HttpOnly-cookie session, the *refresh token* is persisted in
  `localStorage` so sessions survive page reloads. If the backend later offers an
  HttpOnly-cookie refresh flow, switching removes this exposure; no passwords or portfolio
  data are ever stored either way.
- `HashRouter` keeps all routing client-side, so paths never reach a server log.

## Known backend gaps (for future integration)

These are **not implemented in the UI as fake workflows**; the UI is ready for them:

1. **Monitoring-rule CRUD** — creating/editing persistent thresholds, schedules or
   notification preferences has no endpoint; only ad-hoc `check` and `run` exist.
2. **Persisted portfolio/history endpoint** — there is no API to retrieve past analyses or
   historical valuation series, so the dashboard reflects the current session plus alerts.
3. **Alert pagination/metadata** — `GET /api/alerts` exposes no documented total-unread
   count or cursor pagination; the sidebar badge uses `?unread_only=true` length and the
   alerts page paginates client-side.
4. **Logout endpoint** — token revocation server-side isn't in the spec; logout clears
   client state only.
5. **Account-deletion contract** — whether a password body is required for
   `DELETE /managers/me` isn't specified; the UI sends one only when provided.

## Project structure

```
src/
  components/     reusable UI: buttons, fields, cards, modals, skeletons, charts, ResultView
    import/       ExcelImportDialog — privacy-first spreadsheet intake wizard
  context/        auth session, toasts, memory-only session data
  layouts/        auth layout + navy-sidebar dashboard layout
  pages/          landing, login, signup, dashboard, analysis, monitoring, alerts, settings
  routes/         ProtectedRoute
  services/       axios client + per-resource API modules
  types/          TypeScript request/response contracts (canonical fields)
  utils/          formatting, validation (incl. projection matrix), payload inspection,
                  alert normalization, excel.ts (mapping/parse/derive), portfolio.ts
                  (canonical payload builders) — plus excel.test.ts (Vitest suite)
```

## Important disclaimers

All figures, projections and AI narratives are informational estimates produced from your
inputs and backend responses — **not investment advice**, and projected returns are never
guaranteed.
