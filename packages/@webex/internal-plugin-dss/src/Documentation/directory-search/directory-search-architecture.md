# Directory Search & Phone Number Lookup Architecture

## 1. Overview
The Webex JS SDK provides directory search and entity lookup capabilities via the `internal-plugin-dss` (Directory Search Service – DSS). This document describes the phone number lookup capability implemented via a dedicated `lookupByPhoneNumbers()` method that uses the existing backend endpoint `/api/v1/lookup/orgid/{orgId}/phonenumbers`.

### Implementation Status
**Completed:** Dedicated phone number lookup method (`lookupByPhoneNumbers()`) using the existing backend lookup endpoint with max 5 phone numbers per request.

### Goals
- Enable efficient lookup of contact (person/place/device) details using phone numbers.
- Leverage existing DSS infrastructure: Mercury event handling, async results, timeouts, correlation.
- Match backend API contract exactly: max 5 phone numbers per request, no SDK-level batching.
- Preserve request correlation (`requestId` + Mercury events) and device scoping (`cisco-device-url`).
- Maintain API consistency with existing lookup methods (`lookup()`, `lookupByEmail()`).

### Non-Goals
- Implement SDK-level batching/chunking (client responsibility based on UX needs).
- Provide advanced international phone parsing (backend responsibility).
- Provide mutation (create/update) directory entries.
- Replace existing identity/email lookup flows.

## 2. Existing Components
| Component | Responsibility |
|-----------|---------------|
| `internal-plugin-device` | Registers the SDK client; exposes `webex.internal.device.url`, `orgId`; header `cisco-device-url` ties REST calls to this device registration. |
| `internal-plugin-mercury` | Manages websocket connection used for async DSS results (`event:directory.search`, `event:directory.lookup`). |
| `internal-plugin-dss` (`dss.ts`) | Issues POST requests to DSS endpoints, correlates with `requestId`, listens for Mercury events. Includes `search()`, `lookup()`, `lookupByEmail()`, **and new `lookupByPhoneNumbers()`**. |
| `dss-batcher.ts` | Batching engine for lookup (multiple `lookupValues` collapsed into a single HTTP POST). Not used for phone number lookups. |
| Constants (`constants.ts`) | Event names, data paths for assembling final result arrays (reused for phone lookups). |
| Types (`types.ts`) | **New:** `LookupByPhoneNumbersOptions` interface. |

## 3. Phone Number Lookup Data Flow (Implemented)
The phone number lookup follows the same async pattern as other lookup methods:

1. **Client calls** `lookupByPhoneNumbers({ phoneNumbers: ['+15551234567', ...] })` (max 5 numbers)
2. **Validation:** SDK validates array length ≤5, rejects if >5 with clear error message
3. **Request generation:** DSS generates `requestId` (UUID v4) and issues POST to `/lookup/orgid/{orgId}/phonenumbers` with body:
   ```json
   {
     "requestId": "uuid",
     "lookupValues": ["+15551234567", "+15552345678"]
   }
   ```
4. **Headers added:** Core request layer adds `cisco-device-url` (from `webex.internal.device.url`) and authorization
5. **Backend streams** one or more Mercury events (`event:directory.lookup`):
   ```json
   {
     "requestId": "uuid",
     "sequence": 0,
     "finished": true,
     "lookupResult": {
       "entities": [ /* matched entities */ ],
       "entitiesFound": [ "+15551234567" ],
       "entitiesNotFound": [ "+15552345678" ]
     }
   }
   ```
6. **DSS accumulates** sequences until all expected indices received or `finished` reached
7. **Promise resolved** with `{ resultArray, foundArray, notFoundArray }`

This matches the existing `lookup()` and `lookupByEmail()` patterns exactly.

## 4. API Design

### 4.1 Method Signature
```typescript
lookupByPhoneNumbers(options: LookupByPhoneNumbersOptions): Promise<RequestResult>
```

### 4.2 Type Definitions
```typescript
export interface LookupByPhoneNumbersOptions {
  phoneNumbers: string[];  // Max 5 phone numbers
}

export interface RequestResult {
  resultArray: any[];      // All matched entities
  foundArray?: any[];      // Phone numbers successfully found
  notFoundArray?: any[];   // Phone numbers not found
}
```

### 4.3 Usage Example
```typescript
// Single or few numbers (≤5)
const result = await webex.internal.dss.lookupByPhoneNumbers({
  phoneNumbers: ['+15551234567', '+442012345678']
});

console.log('Entities:', result.resultArray);
console.log('Found:', result.foundArray);
console.log('Not found:', result.notFoundArray);
```

### 4.4 Client-Side Batching (for >5 numbers)
```typescript
async function lookupMany(allPhoneNumbers: string[]) {
  const results = [];
  for (let i = 0; i < allPhoneNumbers.length; i += 5) {
    const chunk = allPhoneNumbers.slice(i, i + 5);
    const result = await webex.internal.dss.lookupByPhoneNumbers({
      phoneNumbers: chunk
    });
    results.push(result);
  }
  return {
    resultArray: results.flatMap(r => r.resultArray),
    foundArray: results.flatMap(r => r.foundArray || []),
    notFoundArray: results.flatMap(r => r.notFoundArray || []),
  };
}
```

## 5. Request Construction
**Endpoint:** `POST /lookup/orgid/{orgId}/phonenumbers`

**Request Body:**
```json
{
  "requestId": "uuid-v4",
  "lookupValues": ["+15551234567", "+15552345678"]
}
```

**Headers:**
- `Authorization: Bearer <token>`
- `cisco-device-url: <device.url>`
- `trackingid: <auto-generated>`

## 6. Sequence Diagram
```
Client -> DSS.lookupByPhoneNumbers({ phoneNumbers: ['+15551234567', ...] })
  |
  ├─> Validate: array.length <= 5
  |   └─> if >5: reject Error
  |
  ├─> Generate requestId (UUID v4)
  |
  └─> _request(POST /lookup/orgid/{orgId}/phonenumbers)
      └─> Body: { requestId, lookupValues: [...] }
      └─> Headers: cisco-device-url, Authorization

Backend
  └─> Process lookup
      └─> Emit Mercury event(s): event:directory.lookup
          └─> Payload: { requestId, sequence, finished, lookupResult }

DSS._handleEvent
  └─> Accumulate sequences by requestId
      └─> When finished && all sequences received:
          └─> Resolve Promise with { resultArray, foundArray, notFoundArray }

Client <- Promise resolved
```

## 7. Event Handling
- Reuses existing Mercury event listener for `event:directory.lookup`
- Same correlation mechanism as `lookup()` and `lookupByEmail()`: `requestId` matching
- Uses existing constants:
  - `LOOKUP_DATA_PATH = 'lookupResult.entities'`
  - `LOOKUP_FOUND_PATH = 'lookupResult.entitiesFound'`
  - `LOOKUP_NOT_FOUND_PATH = 'lookupResult.entitiesNotFound'`
  - `LOOKUP_REQUEST_KEY = 'lookupValues'`
- No new event types or listeners required

## 8. Correlation & Headers
- Correlation remains via `requestId` (UUID v4) inserted in request body, matched in Mercury event payload.
- `cisco-device-url` header links the REST call to the active device registration enabling backend to route Mercury events over the established websocket.
- `trackingid` header (auto-added) aids diagnostics; preserve.

## 9. Error Handling
| Scenario | Handling |
|----------|----------|
| Empty array | Return `{ resultArray: [], foundArray: [], notFoundArray: [] }` immediately (no request) |
| >5 phone numbers | Reject with `Error: lookupByPhoneNumbers accepts a maximum of 5 phone numbers. Received: {count}. Please batch requests on the client side if needed.` |
| Timeout (no `finished` event before `config.requestTimeout`) | Reject with `DssTimeoutError` (existing) |
| Malformed phone numbers | Backend returns in `entitiesNotFound` |
| Partial results (some providers unreachable) | Backend sets `finished:true` with available results |
| Network / 4xx / 5xx | Propagate original error from `_request()` |

## 10. Metrics & Logging
Leverage existing DSS logging infrastructure:
- Use existing `this.logger.debug/info/error` streams
- Correlate with `trackingid` and `requestId`
- Log resource path: `/lookup/orgid/{orgId}/phonenumbers`

**Future enhancements (optional):**
- `dss.phone.lookup.hit` / `.miss` counters
- `dss.phone.lookup.duration.ms` histogram
- Mask phone numbers in logs (show last 4 digits only at info/error levels)

## 11. Security & Privacy
- Do not log full phone numbers at `info`/`error`; mask all but last 4 digits when non-debug.
- Ensure Authorization Bearer token scopes allow directory search; if scope insufficient, fail fast.
- Avoid caching PII permanently in memory beyond result objects.

## 12. Performance Considerations
- **No SDK-level batching:** Clients control their own batching strategy based on UX needs
- **Single request for ≤5 numbers:** Typical latency ~200-500ms
- **Client batching for >5 numbers:** Latency depends on client strategy (parallel vs sequential)
- **Timeout:** Reuses existing `Timer` logic from `_request()` (default 10s per request)
- **No additional memory overhead:** Same Mercury event accumulation pattern as other lookups

## 13. Implementation Summary
**Files Modified:**
| File | Changes |
|------|---------|
| `src/types.ts` | Added `LookupByPhoneNumbersOptions` interface |
| `src/dss.ts` | Added `lookupByPhoneNumbers()` method with validation and max 5 limit |
| `test/unit/spec/dss.ts` | *(To be added)* Unit tests |
| `documentation/phone-number-lookup-design.md` | Detailed design document |
| `documentation/directory-search-architecture.md` | *(This file)* Updated architecture |

**No Changes Required:**
- Constants (reused existing `LOOKUP_*` constants)
- Mercury event listeners (reused `event:directory.lookup`)
- Correlation logic (reused `requestId` pattern)
- `dss-batcher.ts` (not used for phone lookups)

## 14. Testing Strategy
| Test | Description |
|------|-------------|
| Unit: empty array | Returns `{ resultArray: [], foundArray: [], notFoundArray: [] }` without network call |
| Unit: single number | Validates request body contains correct `lookupValues` |
| Unit: exactly 5 numbers | Accepts max limit, single `_request()` call |
| Unit: more than 5 numbers | Rejects with clear error message about max limit |
| Unit: timeout | Mock Mercury delay, expect `DssTimeoutError` |
| Unit: found/not found | Verify correct population of `foundArray` and `notFoundArray` |
| Unit: partial sequences | Multiple sequence events aggregated correctly |
| Integration: Mercury mock | Emit `event:directory.lookup` and verify Promise resolution |

## 15. Backward Compatibility
- **No breaking changes:** New method is additive
- **Existing methods unaffected:** `search()`, `lookup()`, `lookupByEmail()` work exactly as before
- **No new dependencies:** Reuses all existing infrastructure
- **API consistency:** Follows same pattern as `lookupByEmail()` (similar signature and behavior)

## 16. Summary
The phone number lookup feature is implemented as a dedicated `lookupByPhoneNumbers()` method that:
- Uses the existing backend endpoint `/api/v1/lookup/orgid/{orgId}/phonenumbers`
- Accepts max 5 phone numbers per request (backend constraint)
- Reuses all existing DSS infrastructure (Mercury events, correlation, timeouts)
- Follows the same pattern as `lookup()` and `lookupByEmail()` for consistency
- Delegates batching strategy to clients based on their specific UX requirements
- Requires no changes to constants, event handlers, or batching logic

For detailed design and usage examples, see [phone-number-lookup-design.md](./phone-number-lookup-design.md).
