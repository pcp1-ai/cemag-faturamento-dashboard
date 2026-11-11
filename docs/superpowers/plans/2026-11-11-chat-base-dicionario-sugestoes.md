# Chat com Base Completa, Dicionário e Sugestões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated chat answer questions from the complete shared published base, understand CEMAG vocabulary through one canonical dictionary, and suggest useful follow-up questions.

**Architecture:** The server loads the current published analytic rows and performs bounded deterministic filtering, aggregation, and grouping before sending only relevant results to the LLM. A shared structured business dictionary supplies aliases, metric meanings, and ambiguity notes to both query interpretation and the model prompt. The response contract carries up to three follow-up prompts derived from the actual query/result; the client renders them as clickable chips that submit a new question.

**Tech Stack:** TypeScript, React, tRPC, Zod, existing SQL analytic-row storage, existing LLM invocation helper, Vitest (existing test setup).

**Spec:** `docs/superpowers/specs/2026-11-11-chat-base-completa-design.md`

## Global Constraints

- The server uses the current published shared base, not browser filters or summaries, as the source of truth.
- Queries are read-only; only administrators publish the base.
- Do not send thousands of source rows to the LLM; query and bound relevant results first.
- Quantity means quantity billed and is not evidence of physical production.
- Do not treat profit as revenue, implemento as carreta, or product/model/family/grouping as interchangeable without evidence.
- Local-only goals are not shared base data; additional dashboard data is used only if provided in the current session or persisted server-side and clearly labeled.
- If the complete base cannot be consulted, return an explicit unavailable-source answer; do not silently fall back to partial summaries.
- Preserve existing authentication, conversation history, and chat UI; add no dependency.

## Review Focus

- **Synonym collides with a distinct metric** (e.g. lucro vs faturamento): pin with dictionary resolution tests that reject unsafe equivalence.
- **Ambiguous product category** (implemento vs carreta): pin with query tests requiring exact canonical category or explicit ambiguity.
- **Question requests an absent field/value**: pin with query tests returning no-match rather than fabricated data.
- **Base changes while cached data exists**: pin with repository/query tests that verify the current base version is used.
- **Failed/empty query produces follow-ups**: pin with response tests asserting no unsupported follow-up chips are emitted.

---

## File Map

- Create `shared/chatDictionary.ts`: canonical aliases, entity/metric definitions, and ambiguity notes.
- Create `server/chatBaseQuery.ts`: parse rows from the published base and execute safe, bounded analytical queries.
- Create `server/chatSuggestions.ts`: generate at most three contextual follow-up questions from the resolved query/result and dictionary.
- Modify `server/routers.ts`: chat orchestration, source-of-truth selection, dictionary prompt context, and response contract.
- Modify `client/src/pages/Home.tsx`: send user question/history without relying on clipped dashboard summaries; handle response and suggestion selection.
- Modify `client/src/components/AIChatBox.tsx` (or the actual existing AIChatBox file path found during implementation): render per-answer suggestion chips and submit selection through the existing send callback.
- Create `server/chatBaseQuery.test.ts`, `server/chatDictionary.test.ts`, and `server/chatSuggestions.test.ts` using the existing Vitest conventions.

### Task 1: Central Business Dictionary

**Files:**
- Create: `shared/chatDictionary.ts`
- Create: `server/chatDictionary.test.ts`
- Modify: `server/routers.ts`
- Modify: `client/src/pages/Home.tsx`

**Interfaces:**
- Export `CHAT_BUSINESS_DICTIONARY` with entries containing `canonical`, `aliases`, `definition`, and optional `ambiguityNote`.
- Export `resolveChatTerm(input: string): { canonical: string; matchedAlias: string } | null` using accent-insensitive normalized whole-token matching.
- Initial canonical entries: `faturamento_valor`, `quantidade_faturada`, `representante`, `cliente`, `municipio`, `uf`, `carreta`, `implemento`, `produto`, `modelo`, `familia`, and `lucro` (explicitly marked as unavailable unless a profit field exists).

- [ ] Add focused dictionary tests for accent normalization, word-boundary matches, known aliases, unknown terms, and distinct `lucro`/`faturamento` meanings.
- [ ] Implement the typed dictionary and resolver in `shared/chatDictionary.ts`; do not include web-only synonyms unless a CEMAG field or administrator definition confirms them.
- [ ] Replace duplicated glossaries in the client prompt context and server prompt with serialized dictionary definitions from this module.
- [ ] Verify dictionary tests and TypeScript check.

### Task 2: Complete-Base Query Engine

**Files:**
- Create: `server/chatBaseQuery.ts`
- Create: `server/chatBaseQuery.test.ts`
- Modify: `server/routers.ts`
- Reference: `server/db.ts` (`getCurrentAnalyticBase`, `listAnalyticRows`)

**Interfaces:**
- `queryPublishedBase(question: string, rows: Record<string, unknown>[], dictionary: typeof CHAT_BUSINESS_DICTIONARY): ChatQueryResult`
- `ChatQueryResult` includes `status: "answered" | "ambiguous" | "no_match"`, `sourceVersion`, `period`, `metric`, `groupBy`, `filters`, `result`, and `limitations`.
- Server orchestration obtains `getCurrentAnalyticBase()` and `listAnalyticRows(current.version)` on every chat request; any cache must be keyed by the exact current base version and invalidated when that version changes.

- [ ] Add query tests using small fixture rows covering full-period totals, year/month filters, grouping and ranking by product/representative/client/location/category, quantity vs value, missing fields, ambiguity, and base version.
- [ ] Implement column alias discovery from the actual published row keys and dictionary canonical fields, preserving unrecognized columns as searchable dimensions.
- [ ] Implement safe filtering, grouping, sum/count/distinct-count, sorting, and top-N with explicit period and metric metadata; cap returned groups and result text.
- [ ] Ensure `lucro` returns an unsupported-field result unless the source contains an explicitly mapped profit column.
- [ ] Integrate the query result in `ai.chat`; return a clear unavailable-base response if no published base or row load error occurs.
- [ ] Verify query tests and TypeScript check.

### Task 3: Grounded Chat Response and Contextual Suggestions

**Files:**
- Create: `server/chatSuggestions.ts`
- Create: `server/chatSuggestions.test.ts`
- Modify: `server/routers.ts`

**Interfaces:**
- `buildChatSuggestions(question: string, query: ChatQueryResult, dictionary: typeof CHAT_BUSINESS_DICTIONARY): string[]` returns zero to three questions.
- Change the chat response payload to `{ content: string; suggestions: string[] }`.

- [ ] Add suggestion tests for representative ranking, product ranking, period comparison, no-match, ambiguous, and query-unavailable cases.
- [ ] Derive suggestions deterministically from actual `groupBy`, metric, selected value filters, and period; filter out prompts whose referenced dimension/field is absent in the base.
- [ ] Update LLM system instructions to answer only from the query result, report period and criterion, and preserve dictionary ambiguity/metric rules.
- [ ] Ask the model for a concise answer; keep suggested follow-ups generated and validated by `buildChatSuggestions`, not by unconstrained model text.
- [ ] Verify suggestion tests and TypeScript check.

### Task 4: Clickable Suggestions in Existing Chat

**Files:**
- Modify: actual existing AIChatBox component file, expected `client/src/components/AIChatBox.tsx`
- Modify: `client/src/pages/Home.tsx`
- Modify: existing chat message type definition file, if separate

**Interfaces:**
- Assistant message shape becomes `{ role: "assistant"; content: string; suggestions?: string[] }`.
- Suggestion selection calls the same `enviarMensagemChat(text)` path as typed user input.
- Client mutation sends `{ messages }`; server resolves the entire shared base independently of active dashboard filters.

- [ ] Add a UI-level test for showing up to three chips and invoking the existing send callback when one is clicked.
- [ ] Remove dependence on clipped `contextoChat` summaries and client-side deterministic answers that can disagree with the full published base; retain only conversation history and the latest question.
- [ ] Render chips beneath the assistant answer with keyboard-accessible buttons; hide chips while a new request is pending and prevent duplicate submits.
- [ ] Add the returned `suggestions` to the assistant message state and route clicks through the normal send handler.
- [ ] Verify component tests, TypeScript check, and production build.

### Task 5: End-to-End Verification and Delivery

**Files:**
- Review all files above; update the design spec only if implementation decisions require an explicit scope change.

- [ ] Run `npm run check`.
- [ ] Run `npm test -- --run` (or the repository's existing Vitest command) for affected and existing tests.
- [ ] Run `npm run build` and inspect generated output for the existing Vercel entrypoint expectations.
- [ ] Manually verify these chat flows against a representative published base: annual value total, most sold product by billed quantity, representative ranking, an ambiguous “implemento” query, an unavailable “lucro” query, and follow-up chip selection.
- [ ] Commit the complete change with message `feat: answer chat questions from full published base`.
- [ ] Push to the connected Git branch and inspect the Vercel deployment result before reporting the live URL.
