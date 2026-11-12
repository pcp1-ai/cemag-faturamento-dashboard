# Google Sheets Faturamento Base Implementation Plan

> **For agentic workers:** Execute task-by-task inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the shared faturamento base and chat source from the private Google Sheets tab `tabelaFaturamento`, without requiring TiDB for the base.

**Architecture:** A server-only provider authenticates with the Google service account, reads columns A:AE, maps the confirmed header row to records, and caches one stable version for five minutes. tRPC metadata, pagination, login period, and chat use this provider; the dashboard stops publishing a competing CSV base.

**Tech Stack:** TypeScript, Node `crypto` and `fetch`, Google Sheets REST API, Express/tRPC, React.

**Spec:** `docs/superpowers/specs/2026-11-12-google-sheets-base-faturamento-design.md`

## Global Constraints

- The sheet is read-only from the dashboard.
- The sheet header is A:AE; ignore the blank AC column and preserve original names for the other headers.
- Use `BAI_MOVIMENTAC` as the primary date with fallback to `BAI_EMISSAO`.
- The Google private key stays on the server, in ignored local environment files and Vercel secrets.
- No unrelated user files or pre-existing untracked files are to be modified.
- No tests or build verification commands will be run unless requested.

## Review Focus

- Missing or malformed service-account configuration must produce a clear server-side error without exposing credentials.
- API permission errors, throttling, empty ranges, and changed headers must not silently return the bundled CSV as fresh data.
- Date cells must remain parseable by the existing Brazilian date parser; numeric and currency fields must retain existing parsing behavior.
- Pagination must reject a version that does not match the loaded sheet snapshot.
- The chat and dashboard must use the same sheet snapshot/version.

## File Map

- Create `server/googleSheets.ts`: credential validation, service-account token, sheet read, header mapping, cache, metadata and page functions.
- Modify `server/routers.ts`: use Sheets for base metadata, period, rows and chat; prevent the old database CSV publication endpoints from becoming another source.
- Modify `client/src/pages/Home.tsx`: consume the source endpoints and remove or replace the admin CSV publication controls.
- Modify `scripts/migrate-if-configured.ts`: skip database migrations when Google Sheets is the configured base and TiDB is no longer part of this deployment path.
- Modify `.env.local` (ignored): add the approved spreadsheet ID and tab name; do not print secret values.
- Modify `docs/superpowers/specs/2026-11-12-google-sheets-base-faturamento-design.md`: record any implementation-level decisions that preserve the approved design.

## Tasks

### Task 1: Add the private Google Sheets provider

**Files:** Create `server/googleSheets.ts`; use ignored `.env.local`.

- [x] Validate required environment fields without logging their values.
- [x] Create and cache a service-account OAuth token with the `spreadsheets.readonly` scope.
- [x] Read `tabelaFaturamento!A1:AE` from the approved spreadsheet using formatted values so dates continue through the existing date parser.
- [x] Map header cells to row objects, omit the blank header, drop fully empty rows, and compute a stable content version.
- [x] Cache the loaded rows and metadata for five minutes; expose metadata, rows, and a version-checked page function.
- [x] Add the spreadsheet ID and tab name to ignored `.env.local`; keep credential keys private.

### Task 2: Route server consumers through the sheet snapshot

**Files:** Modify `server/routers.ts` and `scripts/migrate-if-configured.ts`.

- [x] Replace database-backed base metadata and pages with the Sheets provider.
- [x] Derive login base period from the same raw sheet rows and existing movement/emission date fields.
- [x] Make `ai.chat` query the full current sheet rows and use the same stable version as dashboard pagination.
- [x] Stop accepting database CSV publication as the active source while Sheets mode is configured.
- [x] Skip the failed TiDB migration path when the approved Google Sheets source is configured.

### Task 3: Update dashboard loading and source controls

**Files:** Modify `client/src/pages/Home.tsx`.

- [x] Load all pages from the server metadata/version endpoint and preserve the existing row-processing pipeline.
- [x] Remove the admin CSV publication controls and messages that imply the browser upload replaces the shared source.
- [x] Keep an explicit loading error when Sheets is unavailable and no valid server cache exists.

### Task 4: Record deployment configuration and review changes

**Files:** Modify the approved design document and, if useful, a non-secret `.env.example`.

- [x] Document environment variable names required in Vercel, including spreadsheet ID and tab name, without writing secret values.
- [ ] Review the final diff and Git status to confirm `.env.local`, pre-existing `package-lock.json`, and pre-existing `public/` remain untracked/ignored as before.
- [ ] Do not publish or change Vercel settings in this implementation pass.
