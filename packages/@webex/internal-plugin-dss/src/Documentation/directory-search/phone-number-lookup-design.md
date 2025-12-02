# Phone Number Lookup Feature - Design Document

**Feature:** Phone Number Lookup API  
**Package:** `@webex/internal-plugin-dss`  
**Status:** Implemented

---

## 1. Overview

This document describes the addition of a phone number lookup API to the DSS (Directory Search Service) plugin. The feature enables clients to resolve contact information for up to 5 phone numbers per request by exposing the existing backend endpoint directly without SDK-level batching logic.

**Design Principle:** The SDK API mirrors the backend API contract exactly. Batching/chunking for larger arrays is the client's responsibility based on their specific rendering and UX requirements.

---

## 2. Backend Endpoint

**Existing Endpoint:**  
```
POST /api/v1/lookup/orgid/{orgId}/phonenumbers
```

**Request Parameters:**
- `lookupValues`: Array of phone numbers (max 5 per request)

**Response Structure (via Mercury):**
```json
{
  "requestId": "uuid",
  "sequence": 0,
  "finished": true,
  "lookupResult": {
    "entities": [ /* entity objects */ ],
    "entitiesFound": [ /* phone numbers found */ ],
    "entitiesNotFound": [ /* phone numbers not found */ ]
  }
}
```

**Constraint:** Maximum 5 phone numbers per request.

---

## 3. SDK Implementation

### 3.1 New Type Definition

**File:** `packages/@webex/internal-plugin-dss/src/types.ts`

```typescript
export interface LookupByPhoneNumbersOptions {
  phoneNumbers: string[];
}
```

### 3.2 New Method

**File:** `packages/@webex/internal-plugin-dss/src/dss.ts`

```typescript
async lookupByPhoneNumbers(options: LookupByPhoneNumbersOptions): Promise<RequestResult>
```

**Parameters:**
- `options.phoneNumbers`: Array of phone numbers to lookup (max 5)

**Returns:**
```typescript
{
  resultArray: any[];      // All matched entities
  foundArray: string[];    // Phone numbers successfully found
  notFoundArray: string[]; // Phone numbers not found
}
```

**Behavior:**
1. If `phoneNumbers` is empty, return empty arrays immediately.
2. If >5 phone numbers, reject with `Error` indicating max limit exceeded.
3. Otherwise, make single `_request()` call to backend endpoint.

**Validation:**
- Throws `Error` if more than 5 phone numbers provided
- Throws `DssTimeoutError` if backend doesn't respond within timeout

### 3.3 Client-Side Batching (Optional)

**Why No SDK Batching?**
- Client applications have different rendering expectations (progressive vs. all-at-once)
- UX decisions (progress indicators, partial results, error recovery) vary by use case
- Network strategy (parallel vs. throttled vs. sequential) depends on client context
- SDK should not assume or enforce a specific batching strategy

**Client Implementation Example:**
```typescript
// Client decides chunking strategy based on their UX needs
async function lookupManyPhoneNumbers(phoneNumbers: string[]) {
  const chunkSize = 5;
  const chunks = [];
  
  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    chunks.push(phoneNumbers.slice(i, i + chunkSize));
  }
  
  // Option 1: Parallel (fastest, but all-or-nothing)
  const results = await Promise.all(
    chunks.map(chunk => 
      webex.internal.dss.lookupByPhoneNumbers({ phoneNumbers: chunk })
    )
  );
  
  // Option 2: Sequential with progress (better UX for large lists)
  const results = [];
  for (const chunk of chunks) {
    const result = await webex.internal.dss.lookupByPhoneNumbers({ phoneNumbers: chunk });
    results.push(result);
    updateProgressBar((results.length / chunks.length) * 100);
  }
  
  // Merge results
  return {
    resultArray: results.flatMap(r => r.resultArray),
    foundArray: results.flatMap(r => r.foundArray),
    notFoundArray: results.flatMap(r => r.notFoundArray),
  };
}
```

---

## 4. Usage Examples

### 4.1 Single Phone Number
```typescript
const result = await webex.internal.dss.lookupByPhoneNumbers({
  phoneNumbers: ['+15551234567']
});

if (result.foundArray.length > 0) {
  console.log('Contact:', result.resultArray[0]);
}
```

### 4.2 Multiple Phone Numbers (≤5)
```typescript
const result = await webex.internal.dss.lookupByPhoneNumbers({
  phoneNumbers: [
    '+15551234567',
    '+442012345678',
    '+33123456789'
  ]
});

console.log('Found:', result.foundArray);
console.log('Not found:', result.notFoundArray);
console.log('Entities:', result.resultArray);
```

### 4.3 Exceeding Limit (>5)
```typescript
const phoneNumbers = [
  '+15551111111', '+15552222222', '+15553333333',
  '+15554444444', '+15555555555', '+15556666666' // 6 numbers
];

try {
  const result = await webex.internal.dss.lookupByPhoneNumbers({
    phoneNumbers
  });
} catch (error) {
  // Error: lookupByPhoneNumbers accepts a maximum of 5 phone numbers. Received: 6.
  // Please batch requests on the client side if needed.
  console.error(error.message);
}
```

### 4.4 Client-Side Batching Example
```typescript
// For large arrays, client implements batching strategy
async function batchLookup(allPhoneNumbers: string[]) {
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
    foundArray: results.flatMap(r => r.foundArray),
    notFoundArray: results.flatMap(r => r.notFoundArray),
  };
}

const allResults = await batchLookup([
  '+15551111111', '+15552222222', '+15553333333',
  '+15554444444', '+15555555555', '+15556666666',
  '+15557777777', '+15558888888'
]);
```

### 4.5 Empty Array
```typescript
const result = await webex.internal.dss.lookupByPhoneNumbers({
  phoneNumbers: []
});
// Returns: { resultArray: [], foundArray: [], notFoundArray: [] }
```

---

## 5. Error Handling

**Timeout:**  
If request exceeds `config.dss.requestTimeout` (default 10s), `DssTimeoutError` is thrown.

**Max Limit Exceeded:**  
If more than 5 phone numbers provided, method rejects with:
```
Error: lookupByPhoneNumbers accepts a maximum of 5 phone numbers. Received: N. Please batch requests on the client side if needed.
```

**Invalid Input:**  
- Empty array: Returns `{ resultArray: [], foundArray: [], notFoundArray: [] }` (no error)
- Non-string values: Undefined behavior (backend validation)
- Malformed phone numbers: Backend returns in `entitiesNotFound`

---

## 6. Testing Strategy

### 6.1 Unit Tests (To Be Added)

**File:** `packages/@webex/internal-plugin-dss/test/unit/spec/dss.ts`

**Test Cases:**
1. **Empty array:** Returns `{ resultArray: [], foundArray: [], notFoundArray: [] }`
2. **Single phone number:** Single `_request()` call, verify entity returned
3. **Exactly 5 phone numbers:** Single request, all found
4. **More than 5 phone numbers:** Rejects with error indicating max limit
5. **Mixed found/not found (≤5):** Verify `foundArray` and `notFoundArray` correctly populated
6. **Timeout scenario:** Mock Mercury delay, ensure `DssTimeoutError` thrown

### 6.2 Integration Tests

Test against real backend (if available) with:
- Valid org phone numbers
- Invalid/external numbers
- Edge cases (special characters, varying formats)

---

## 7. Backend Response Structure

### 7.1 How We Determined Mercury Event Shape

The phone number lookup endpoint `/api/v1/lookup/orgid/{orgId}/phonenumbers` follows the same Mercury event pattern as other DSS lookup endpoints (`/identities`, `/emails`). This is evident from:

1. **Existing DSS Plugin Implementation:**
   - All lookup endpoints emit `event:directory.lookup` Mercury events
   - Response structure documented in `dss-mercury-response-structure.md`
   - Constants defined in `constants.ts`:
     - `LOOKUP_DATA_PATH = 'lookupResult.entities'`
     - `LOOKUP_FOUND_PATH = 'lookupResult.entitiesFound'`
     - `LOOKUP_NOT_FOUND_PATH = 'lookupResult.entitiesNotFound'`

2. **Consistent Pattern Across Lookup Endpoints:**
   ```typescript
   // All lookup endpoints use same structure
   lookupByEmail() → /lookup/.../emails
   lookup()        → /lookup/.../identities
   lookupByPhoneNumbers() → /lookup/.../phonenumbers
   
   // All emit same Mercury event shape
   event:directory.lookup {
     requestId: string,
     sequence: number,
     finished: boolean,
     lookupResult: {
       entities: Array,
       entitiesFound: Array,
       entitiesNotFound: Array
     }
   }
   ```

3. **Backend Consistency:**
   - DSS backend uses uniform response format for all `/lookup/orgid/{orgId}/*` endpoints
   - Phone numbers passed in `lookupValues` parameter (same as emails/identities)
   - Response contains matching phone numbers in `entitiesFound`, non-matching in `entitiesNotFound`

### 7.2 Mercury Event Flow Verification

The implementation reuses existing `_request()` method which:
- Listens for `event:directory.lookup` (via `DSS_LOOKUP_MERCURY_EVENT` constant)
- Parses payload using established paths (`LOOKUP_DATA_PATH`, `LOOKUP_FOUND_PATH`, `LOOKUP_NOT_FOUND_PATH`)
- Accumulates sequences and returns `{ resultArray, foundArray, notFoundArray }`

No new event types or parsers needed—existing infrastructure handles phone lookups transparently.

---

## 8. Files Modified

| File | Change |
|------|--------|
| `src/types.ts` | Added `LookupByPhoneNumbersOptions` interface |
| `src/dss.ts` | Added `lookupByPhoneNumbers()` method (max 5 validation, single request) |
| `test/unit/spec/dss.ts` | *(To be added)* Unit tests for new method |
| `documentation/phone-number-lookup-design.md` | *(This file)* Design documentation |
| `documentation/directory-search-architecture.md` | Updated architecture with phone lookup details |

**Key Implementation Detail:** No chunking/batching logic in SDK—method enforces max 5 limit and delegates batching to clients.

---
