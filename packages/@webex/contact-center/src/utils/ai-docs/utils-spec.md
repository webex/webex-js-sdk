# Utils — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the module's canonical specification.

## Metadata

| Field | Value |
|---|---|
| Module id | `utils` |
| Source path(s) | `src/utils` |
| Doc kind | Module spec |
| Coverage score | 100% assessed 2026-07-07; 15/15 mandatory fields present; no applicability gaps |
| Generated from | `module-spec` @ SDLC template library `0.2.1` |
| generated_by / approved_by / updated_at | Codex generator / developer-approved residual warning and coverage completion / 2026-07-07 |
| Validation status | pass; validator claude-code; assessed 2026-07-07; 0 Blocking, 0 warnings; clean independent revalidation complete |

## Evidence Rules
Every requirement cites stable source and test file paths. Code/tests are the behavioral referee; routed source text supplies explicit intent and rationale. Missing or contradictory evidence blocks promotion.

## Source Material Register
| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| Reviewed prior module guides and architecture material | overview / architecture / API / tests | used and code-checked | Content is placed by meaning throughout this specification; exact routing remains in the manifest. |

## Overview
Utils is one of nine confirmed Contact Center SDK modules. Own shared pagination contracts and the bounded in-memory page cache used by Contact Center data services. Existing reviewed documentation is migrated by meaning and code/tests remain the behavioral referee.

The utils scope currently provides shared pagination and cache behavior for contact-center data services:

- **Typed Pagination Contracts**: Reusable interfaces for response metadata and query params

- **Generic In-Memory Page Caching**: `PageCache<T>` utility for simple pagination reuse

- **Cache Safety Rules**: Explicit bypass behavior for search/filter/sort scenarios

- **Spec-Driven Utility Workflow**: Utility-specific implementation and validation flow documented inline in this file

| Component             | File                             | Description                                                                                                                                     |
|---|---|---|
| `PageCache`           | [`PageCache.ts`](../PageCache.ts) | Generic in-memory cache utility for paginated API responses with TTL expiry and helper methods for key generation and cache eligibility checks. |

| Component             | File                             | Description                                                                                                                                     |
|---|---|---|
| `Pagination Types`    | [`PageCache.ts`](../PageCache.ts) | `PaginationMeta`, `PaginatedResponse<T>`, `BaseSearchParams`, and `PageCacheEntry<T>` shared across data services.                              |

| Component             | File                             | Description                                                                                                                                     |
|---|---|---|
| `Pagination Defaults` | [`PageCache.ts`](../PageCache.ts) | `PAGINATION_DEFAULTS` (`PAGE`, `PAGE_SIZE`) used by services for consistent request defaults.                                                   |

| Component             | File                             | Description                                                                                                                                     |
|---|---|---|
| `Specs Workflow`      | `AGENTS.md` (inline)             | Mermaid flow for specs-driven utility changes, acceptance criteria, and drift checks.                                                           |

## Purpose / Responsibility
Own shared pagination contracts and the bounded in-memory page cache used by Contact Center data services.

## Stack
TypeScript 5.4 generics, in-memory Map/clock, LoggerProxy, Jest consumer tests.

## Folder / Package Structure
```text
src/utils/
├── AGENTS.md
├── PageCache.ts
```

```text
src/utils/
├── AGENTS.md          # This file: utils scope guide
└── PageCache.ts       # Generic cache + pagination contracts/defaults
```

## Key Files (source of truth)
| File | Holds |
|---|---|
| `src/utils/PageCache.ts` | Authoritative PageCache implementation plus pagination/cache contracts and defaults. |
| `src/types.ts` | Package-wide public response/search types that consume PageCache contracts; not a Utils implementation. |
| `src/services/AddressBook.ts` | Services-layer PageCache consumer. |
| `src/services/EntryPoint.ts` | Services-layer PageCache consumer. |
| `src/services/Queue.ts` | Services-layer PageCache consumer. |

## Public Surface
| Surface | Availability | Source |
|---|---|---|
| `PageCache<T>` | exported from the Utils module file for internal service use; not re-exported by package root | `src/utils/PageCache.ts` |
| `PaginationMeta`, `PaginatedResponse<T>`, `BaseSearchParams` | exported by PageCache module and consumed by package-wide types | `src/utils/PageCache.ts`, `src/types.ts` |
| `PAGINATION_DEFAULTS`, `PageCacheEntry<T>`, `CacheValidationParams` | PageCache module exports; not package-root exports | `src/utils/PageCache.ts` |
| AddressBook/EntryPoint/Queue public response/search aliases | package-root exports whose definitions indirectly use PageCache contracts | `src/types.ts`, `src/index.ts` |

No claim is made that `src/types.ts`, AddressBook, EntryPoint, or Queue is implemented by Utils.

## Requires (dependencies)
- LoggerProxy
- In-memory Map and wall clock
- AddressBook, EntryPoint, and Queue consumers

## Requirements
| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| UTILS-R-001 | Use cache only for simple pagination requests without search, filter, attributes, or sortBy. | Parameterized queries cannot safely reuse a page keyed only by organization/page/pageSize. | `src/utils/PageCache.ts` | `test/unit/spec/services/AddressBook.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| UTILS-R-002 | Build cache keys from `orgId:page:pageSize`. | Organization and page boundaries prevent cross-tenant or cross-page reuse. | `src/utils/PageCache.ts` | `test/unit/spec/services/EntryPoint.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| UTILS-R-003 | Expire entries after the configured five-minute TTL and delete them on stale lookup. | Bounded staleness prevents indefinite reuse of remote service data. | `src/utils/PageCache.ts` | `test/unit/spec/services/Queue.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| UTILS-R-004 | Cache data with total-page/record metadata and allow owning consumers to clear the cache. | Paginated services need consistent metadata without transferring ownership of remote records to the SDK. | `src/utils/PageCache.ts` | `test/unit/spec/services/AddressBook.ts` | Independent clean revalidation pending after residual cleanup. | PRESENT |
| UTILS-R-005 | Accept already-fetched page values from consuming services and never store or process credentials; use `orgId` only to isolate in-memory cache keys. | Authentication remains in Services/Core and tenant-separated keys prevent cross-organization cache reuse. | `src/utils/PageCache.ts`, `src/services/core/WebexRequest.ts` | `test/unit/spec/services/AddressBook.ts` | None; security/auth ownership is explicit. | PRESENT |
| UTILS-R-006 | Keep PageCache free of rollout flags; consuming services decide whether to invoke it and query parameters determine cache eligibility. | Cache correctness must depend on request shape, not hidden deployment state. | `src/utils/PageCache.ts` | `test/unit/spec/services/AddressBook.ts`, `test/unit/spec/services/Queue.ts` | None; rollout applicability is explicitly N/A. | PRESENT |

## Design Overview
Utils separates its stable consumption boundary from collaborators so ownership and failure behavior stay explicit. Caching is intentionally limited to simple page browsing; search/filter/sort requests bypass cache to prevent incorrect reuse.

> **This is the authoritative documentation for the `src/utils` scope.** It covers shared pagination/cache contracts used by data services. For task routing and cross-service conventions, see the [root orchestrator AGENTS.md](../../../AGENTS.md).

Current consumers of `PageCache` and defaults:

| Consumer                | File                                                       | Usage                                                        |
|---|---|---|
| `AddressBook`           | [`../../services/AddressBook.ts`](../../services/AddressBook.ts) | Caches paged address-book responses                          |

| Consumer                | File                                                       | Usage                                                        |
|---|---|---|
| `EntryPoint`            | [`../../services/EntryPoint.ts`](../../services/EntryPoint.ts)   | Caches paged entry-point responses                           |

| Consumer                | File                                                       | Usage                                                        |
|---|---|---|
| `Queue`                 | [`../../services/Queue.ts`](../../services/Queue.ts)             | Caches paged queue responses                                 |

| Consumer                | File                                                       | Usage                                                        |
|---|---|---|
| `Public type contracts` | [`../../types.ts`](../../types.ts)                               | Re-exports pagination/search contracts into SDK-facing types |

Cross-scope mention:

- Services-layer docs reference utils caching contracts at [`../../services/ai-docs/services-spec.md`](../../services/ai-docs/services-spec.md).

## Data Flow
```mermaid
flowchart LR
  Service[AddressBook / EntryPoint / Queue] --> Eligible{canUseCache params?}
  Eligible -->|search/filter/attributes/sort present| Backend[Fetch without cache]
  Eligible -->|simple pagination| Key[buildCacheKey orgId:page:pageSize]
  Key --> Lookup[getCachedPage]
  Lookup -->|fresh| Hit[Return cached page]
  Lookup -->|missing or TTL expired| Backend
  Backend --> Store[cachePage data + total metadata]
  Store --> Result[Return fetched page]
```

## Sequence Diagram(s)
Sequence coverage:

| Operation group | Diagram | Failure / recovery coverage |
|---|---|---|
| Cache eligibility | Service passes search/filter/attributes/sort inputs to `canUseCache`. | Any advanced query bypasses cache rather than risking an incorrect hit. |
| Cache-key construction | `buildCacheKey(orgId, page, pageSize)` isolates organization and page boundaries. | Callers must not substitute user/scope identifiers for `orgId`. |
| TTL lookup/expiry | `getCachedPage` returns a fresh entry or deletes and misses an expired entry. | Expiry is a normal miss; it does not return stale data. |
| Page insertion and clearing | `cachePage` stores data/timestamp/normalized totals; `clearCache` removes all entries. | Backend request failures are owned by the consuming service and are never cached as successes. |

```mermaid
sequenceDiagram
  participant Service as Data service
  participant Cache as PageCache
  participant API as Backend API
  Service->>Cache: canUseCache(params)
  alt simple pagination
    Service->>Cache: buildCacheKey(orgId, page, pageSize)
    Service->>Cache: getCachedPage(key)
    alt fresh hit
      Cache-->>Service: PageCacheEntry
    else miss or expired
      Service->>API: fetch page
      API-->>Service: data + meta
      Service->>Cache: cachePage(key, data, meta)
    end
  else advanced query
    Service->>API: fetch without cache
  end
```

## Class / Component Relationships
```mermaid
classDiagram
  class PageCache~T~ {
    +canUseCache(params) boolean
    +buildCacheKey(orgId, page, pageSize) string
    +getCachedPage(key) PageCacheEntry
    +cachePage(key, data, meta)
    +clearCache()
    +getCacheSize() number
  }
  class AddressBook
  class EntryPoint
  class Queue
  AddressBook --> PageCache : consumes
  EntryPoint --> PageCache : consumes
  Queue --> PageCache : consumes
```

## Use Cases
- **UC-1 Cache eligibility:** AddressBook, EntryPoint, or Queue bypasses cache whenever search, filter, attributes, or sort is supplied. Evidence: `src/utils/PageCache.ts`, `test/unit/spec/services/AddressBook.ts`.
- **UC-2 Cache-key construction:** a simple page lookup uses the exact `orgId:page:pageSize` key so tenant and pagination boundaries cannot collide. Evidence: `src/utils/PageCache.ts`, `test/unit/spec/services/AddressBook.ts`.
- **UC-3 TTL lookup/expiry:** a fresh cached entry is returned; an expired entry is deleted and treated as a miss. Evidence: `src/utils/PageCache.ts`, `test/unit/spec/services/AddressBook.ts`.
- **UC-4 Page insertion and clearing:** successful page data and normalized totals are cached, while `clearCache()` removes all entries for that service instance. Evidence: `src/utils/PageCache.ts`, `test/unit/spec/services/AddressBook.ts`.

## State Model
Utils retains only in-memory runtime state. Durable domain records remain owned by remote Webex services. State changes are driven by explicit calls, events, timers, or actor transitions documented below.

`PageCache<T>` provides a consistent caching model for paginated list APIs. It is optimized for simple page browsing and intentionally bypasses cache for parameterized query cases (`search`, `filter`, `attributes`, `sortBy`).

```typescript
import PageCache, {PAGINATION_DEFAULTS} from '../utils/PageCache';

const cache = new PageCache<MyItem>('MyService');

const page = PAGINATION_DEFAULTS.PAGE;
const pageSize = PAGINATION_DEFAULTS.PAGE_SIZE;
const cacheKey = cache.buildCacheKey(orgId, page, pageSize);

// Include sortBy only for services that support sorting.
const canUseCache = cache.canUseCache({search, filter, attributes, sortBy});

if (canUseCache) {
  const cachedEntry = cache.getCachedPage(cacheKey);
  if (cachedEntry) {
    return {
      data: cachedEntry.data,
      meta: {
        page,
        pageSize,
        ...cachedEntry.totalMeta,
      },
    };
  }
}

const response = await fetchPageFromApi();

if (canUseCache && response.data) {
  cache.cachePage(cacheKey, response.data, response.meta);
}

return response;
```

```mermaid
graph TD
  A[Request arrives with orgId/page/pageSize] --> B{canUseCache?}
  B -->|No: search/filter/attributes/sortBy provided| C[Bypass cache and call API]
  B -->|Yes| D[buildCacheKey orgId:page:pageSize]
  D --> E["getCachedPage(cacheKey)"]
  E -->|Miss| C
  E -->|Hit and not expired| F[Return cached data and totalMeta]
  E -->|Hit but expired >= 5 minutes| G[Delete entry and treat as miss]
  G --> C
  C --> H[Receive API response]
  H --> I["cachePage(cacheKey, data, meta)"]
  I --> J[Return fresh response]
```

Creates a typed cache instance and stores `apiName` for `LoggerProxy` context.

Returns `true` only when all of these are absent:

- `search`

- `filter`

- `attributes`

- `sortBy`

`sortOrder` alone does not trigger cache bypass because `CacheValidationParams` currently keys bypass on fields that materially change the query result set in existing consumers.

Builds deterministic cache key format:

```text
${orgId}:${page}:${pageSize}
```

Behavior:

1. Returns `null` if key not found

2. Computes cache age in minutes

3. If age is `>= 5`, logs expiry, deletes entry, returns `null`

4. Otherwise returns cached entry

Stores entry with:

- `data`

- `timestamp`

- `totalMeta.totalPages`

- `totalMeta.totalRecords` mapped from `meta.totalRecords || meta.totalItems`

Clears all entries and logs cleared entry count.

Returns current in-memory entry count.

Note: `clearCache()` and `getCacheSize()` are available for future use and are not currently called by existing consumers.

## Business Rules & Invariants
- Utils must preserve its typed public/event contracts and must not invent backend states or responses. Enforced in `src/utils/PageCache.ts`.
- Security/auth applicability is limited to tenant separation: PageCache receives already-fetched values, owns no credentials, and includes `orgId` in cache keys.
- Rollout applicability is N/A: PageCache has no feature flag; consumers choose whether to use it and `canUseCache` decides eligibility from query parameters.

## Pitfalls
- Do not bypass the Utils ownership boundary or duplicate its constants/events; doing so breaks correlation, compatibility, or state invariants.

## Module Do's / Don'ts
- DO use the authoritative files and typed constants listed above.
- DON'T use raw event strings, swallow errors, or infer backend behavior.

When changing `src/utils` behavior or contracts:

1. Follow the workflow diagram below

2. Define acceptance criteria for contract and runtime behavior

3. Verify cache TTL, bypass rules, and key schema

4. Validate no spec drift before shipping

```mermaid
flowchart TD
  A[Change proposed in src/utils] --> B{Classify change scope}
  B -->|Contract change| C[Document expected API/type behavior]
  B -->|Runtime behavior change| D[Document cache behavior and TTL impact]
  B -->|Both| C
  C --> E[Update utils AGENTS.md contracts and consumer map]
  D --> F[Validate cache key schema and bypass conditions]
  E --> G[Run drift check against PageCache.ts and consumer services]
  F --> G
  G --> H{Behavior and docs aligned?}
  H -->|No| I[Revise implementation/docs and re-validate]
  I --> G
  H -->|Yes| J[Prepare PR with acceptance criteria and evidence]
```

## Key Design Trade-off
- Caching is intentionally limited to simple page browsing; search/filter/sort requests bypass cache to prevent incorrect reuse.

## Test-Case Strategy (module)
PageCache has no dedicated unit file; characterize it through `test/unit/spec/services/AddressBook.ts`, `EntryPoint.ts`, and `Queue.ts`. Cover query bypass, `orgId:page:pageSize` keys, hit/miss, five-minute expiry/deletion, metadata mapping, and clear behavior. Treat absent direct PageCache tests as a maintenance gap, not as evidence that consumers own the implementation.

## Traceability
- Repo architecture: `../../../ai-docs/ARCHITECTURE.md` · Registry: `../../../ai-docs/SPEC_INDEX.md`
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`

- [Root orchestrator AGENTS.md](../../../AGENTS.md) - Task routing and critical package rules

- [PageCache implementation](../PageCache.ts)
