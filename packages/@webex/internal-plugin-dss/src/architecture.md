# Directory Search Service (DSS) - Architecture Documentation

**Package:** `@webex/internal-plugin-dss`  
**Version:** 1.0  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Mercury Event System](#3-mercury-event-system)
4. [Phone Number Lookup Feature](#4-phone-number-lookup-feature)
5. [API Reference](#5-api-reference)
6. [Error Handling](#6-error-handling)
7. [Testing Strategy](#7-testing-strategy)
8. [Security & Privacy](#8-security--privacy)

---

## 1. Overview

The Directory Search Service (DSS) plugin provides directory search and entity lookup capabilities within the Webex JS SDK. It enables applications to:

- Search for people, rooms, devices, and other entities by name or attributes
- Lookup entities by ID, email address, or phone number
- Retrieve detailed contact information
- Search for places and schedulable rooms

### 1.1 Key Capabilities

| Capability | Method | Description |
|------------|--------|-------------|
| Entity Search | `search()` | Search for entities by query string |
| Place Search | `searchPlaces()` | Search for places and rooms |
| ID Lookup | `lookup()` | Lookup entity by ID |
| Email Lookup | `lookupByEmail()` | Lookup entity by email |
| Phone Lookup | `lookupByPhoneNumbers()` | Lookup entities by phone numbers (NEW) |
| Detailed Lookup | `lookupDetail()` | Get detailed entity information |

### 1.2 Design Principles

- **Asynchronous by design:** All operations use Mercury websockets for async result delivery
- **Request correlation:** Each request generates a unique `requestId` for tracking
- **Sequence handling:** Backend can stream results in multiple sequences
- **Backend constraint respect:** SDK mirrors backend API contracts (e.g., max 5 phone numbers)
- **Client-side batching:** Large operations are client's responsibility based on UX needs

---

## 2. System Architecture

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Application                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              @webex/internal-plugin-dss                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Public API (search, lookup, lookupByPhoneNumbers)  │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Core Methods (_request, _handleEvent)              │   │
│  └──────────┬────────────────────────┬──────────────────┘   │
│             │                        │                       │
└─────────────┼────────────────────────┼───────────────────────┘
              │                        │
              ▼                        ▼
┌─────────────────────────┐  ┌──────────────────────────┐
│ internal-plugin-mercury │  │ internal-plugin-device   │
│ (WebSocket Events)      │  │ (Device Registration)    │
└─────────────┬───────────┘  └──────────┬───────────────┘
              │                         │
              ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend DSS Service                        │
│  • /search/orgid/{orgId}/entities                           │
│  • /lookup/orgid/{orgId}/identities                         │
│  • /lookup/orgid/{orgId}/emails                             │
│  • /lookup/orgid/{orgId}/phonenumbers (NEW)                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### 2.2.1 internal-plugin-device
- Registers SDK client with backend
- Provides `webex.internal.device.url` and `orgId`
- Adds `cisco-device-url` header to all requests
- Links REST calls to Mercury websocket connection

#### 2.2.2 internal-plugin-mercury
- Manages persistent websocket connection
- Receives async results via events:
  - `event:directory.search` - Search results
  - `event:directory.lookup` - Lookup results
- Ensures reliable message delivery

#### 2.2.3 internal-plugin-dss
**File:** `src/dss.ts`

Core responsibilities:
- Issues POST requests to DSS endpoints
- Generates unique `requestId` for correlation
- Listens for Mercury events matching `requestId`
- Accumulates multi-sequence responses
- Handles timeouts and errors

**Key Methods:**
- `register()` - Connect to Mercury and start listening
- `unregister()` - Disconnect and cleanup
- `_request()` - Core request handler with timeout management
- `_handleEvent()` - Process incoming Mercury events

#### 2.2.4 dss-batcher
**File:** `src/dss-batcher.ts`

- Batching engine for lookup operations
- Collapses multiple `lookupValues` into single HTTP POST
- Used by `lookup()` when `shouldBatch: true`
- **Not used** for phone number lookups (by design)

### 2.3 Request Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. Call DSS method
     ▼
┌──────────────────────────────────────┐
│  DSS Plugin                          │
│  • Validate input                    │
│  • Generate requestId (UUID v4)      │
│  • Start timeout timer               │
└────┬─────────────────────────────────┘
     │ 2. POST with requestId
     ▼
┌──────────────────────────────────────┐
│  Backend DSS Service                 │
│  • Process request                   │
│  • Stream results via Mercury        │
└────┬─────────────────────────────────┘
     │ 3. Mercury events
     ▼
┌──────────────────────────────────────┐
│  Mercury Plugin                      │
│  • Receive event:directory.*         │
│  • Emit to DSS plugin                │
└────┬─────────────────────────────────┘
     │ 4. Event with requestId
     ▼
┌──────────────────────────────────────┐
│  DSS Plugin                          │
│  • Match requestId                   │
│  • Accumulate sequences              │
│  • Resolve promise when complete     │
└────┬─────────────────────────────────┘
     │ 5. Result object
     ▼
┌──────────┐
│  Client  │
└──────────┘
```

---

## 3. Mercury Event System

### 3.1 Event Types

The DSS plugin listens for two Mercury event types:

| Event Name | Used By | Purpose |
|------------|---------|---------|
| `event:directory.search` | `search()`, `searchPlaces()` | Streamed search results |
| `event:directory.lookup` | `lookup()`, `lookupByEmail()`, `lookupByPhoneNumbers()` | Lookup results with found/not found arrays |

### 3.2 Event Payload Structure

#### 3.2.1 Search Event Payload

```json
{
  "data": {
    "requestId": "uuid-v4-string",
    "sequence": 0,
    "finished": true,
    "directoryEntities": [
      {
        "id": "Y2lzY29zcGFyazovL...",
        "displayName": "John Doe",
        "emails": ["john.doe@example.com"],
        "phoneNumbers": ["+15551234567"],
        "type": "PERSON"
      }
    ]
  }
}
```

**Data Paths (Constants):**
- `SEARCH_DATA_PATH = 'directoryEntities'`

#### 3.2.2 Lookup Event Payload

```json
{
  "data": {
    "requestId": "uuid-v4-string",
    "sequence": 0,
    "finished": true,
    "lookupResult": {
      "entities": [
        {
          "id": "Y2lzY29zcGFyazovL...",
          "displayName": "Jane Smith",
          "emails": ["jane.smith@example.com"],
          "phoneNumbers": ["+15559876543"],
          "type": "PERSON"
        }
      ],
      "entitiesFound": ["+15551234567"],
      "entitiesNotFound": ["+15559999999"]
    }
  }
}
```

**Data Paths (Constants):**
- `LOOKUP_DATA_PATH = 'lookupResult.entities'`
- `LOOKUP_FOUND_PATH = 'lookupResult.entitiesFound'`
- `LOOKUP_NOT_FOUND_PATH = 'lookupResult.entitiesNotFound'`
- `LOOKUP_REQUEST_KEY = 'lookupValues'`

### 3.3 Sequence Handling

Backend may stream results in multiple sequences for large result sets:

```javascript
// Sequence 0 (not finished)
{ requestId: "abc", sequence: 0, finished: false, directoryEntities: [data0] }

// Sequence 1 (not finished)
{ requestId: "abc", sequence: 1, finished: false, directoryEntities: [data1] }

// Sequence 2 (finished)
{ requestId: "abc", sequence: 2, finished: true, directoryEntities: [data2] }
```

**Plugin Behavior:**
1. Accumulates data per sequence index
2. When `finished: true` received, knows highest sequence number
3. Waits for all indices (0..sequence) to arrive
4. Concatenates arrays in sequence order
5. Resolves promise with complete result

**Out-of-order handling:** Events may arrive in any order; plugin stores by index and assembles correctly.

### 3.4 Request Correlation

```javascript
// 1. Generate requestId
const requestId = uuid.v4(); // e.g., "a1b2c3d4-..."

// 2. Send in request body
webex.request({
  service: 'directoryservice',
  resource: '/lookup/orgid/.../phonenumbers',
  body: { requestId, lookupValues: ['+15551234567'] }
});

// 3. Listen for matching event
this.listenTo(this, `dss:result${requestId}`, handler);

// 4. Mercury event includes requestId
{ data: { requestId: "a1b2c3d4-...", ... } }
```

### 3.5 Timeout Management

```javascript
// Start timer on request
const timer = new Timer(() => {
  this.stopListening(this, eventName);
  reject(new DssTimeoutError({requestId, timeout, resource, params}));
}, this.config.requestTimeout); // Default: 10000ms

// Reset on each event
this.listenTo(this, eventName, (data) => {
  timer.reset(); // Extend timeout on partial data
  // ... accumulate data ...
});

// Cancel on completion
timer.cancel();
```

---

## 4. Phone Number Lookup Feature

### 4.1 Overview

The phone number lookup feature enables resolution of contact information using phone numbers. It follows the same async Mercury-based pattern as other lookup methods.

**Key Characteristics:**
- Max 5 phone numbers per request (backend constraint)
- No SDK-level batching (client responsibility)
- Reuses existing Mercury event infrastructure
- Returns found/not found arrays for tracking

### 4.2 API Design

#### 4.2.1 Method Signature

```typescript
lookupByPhoneNumbers(phoneNumbers: string[]): Promise<RequestResult>
```

**Changed from original design:** Simplified from `options: LookupByPhoneNumbersOptions` to direct `phoneNumbers: string[]` parameter based on code review feedback.

#### 4.2.2 Return Type

```typescript
interface RequestResult {
  resultArray: any[];       // All matched entities
  foundArray: string[];     // Phone numbers successfully found
  notFoundArray: string[];  // Phone numbers not found
}
```

### 4.3 Request/Response Flow

#### 4.3.1 Request Construction

```http
POST /api/v1/lookup/orgid/{orgId}/phonenumbers
Content-Type: application/json
Authorization: Bearer <token>
cisco-device-url: <device.url>
trackingid: <auto-generated>

{
  "requestId": "uuid-v4",
  "lookupValues": ["+15551234567", "+442012345678"]
}
```

#### 4.3.2 Mercury Response

```json
{
  "requestId": "uuid-v4",
  "sequence": 0,
  "finished": true,
  "lookupResult": {
    "entities": [
      {
        "id": "Y2lzY29zcGFyazovL...",
        "displayName": "John Doe",
        "emails": ["john.doe@example.com"],
        "phoneNumbers": ["+15551234567", "84264167"],
        "type": "PERSON"
      }
    ],
    "entitiesFound": ["+15551234567"],
    "entitiesNotFound": ["+442012345678"]
  }
}
```

### 4.4 Implementation Details

#### 4.4.1 Validation Logic

```javascript
// Empty array - immediate return
if (!phoneNumbers || phoneNumbers.length === 0) {
  return Promise.resolve({
    resultArray: [], 
    foundArray: [], 
    notFoundArray: []
  });
}

// Max limit enforcement
if (phoneNumbers.length > 5) {
  this.logger.error(
    `DSS->lookupByPhoneNumbers#ERROR, Maximum of 5 phone numbers allowed, received: ${phoneNumbers.length}`
  );
  return Promise.reject(new Error(
    `lookupByPhoneNumbers accepts a maximum of 5 phone numbers. Received: ${phoneNumbers.length}. ` +
    `Please batch requests on the client side if needed.`
  ));
}
```

#### 4.4.2 Request Execution

```javascript
const resource = `/lookup/orgid/${this.webex.internal.device.orgId}/phonenumbers`;

return this._request({
  dataPath: LOOKUP_DATA_PATH,
  foundPath: LOOKUP_FOUND_PATH,
  notFoundPath: LOOKUP_NOT_FOUND_PATH,
  resource,
  params: {
    [LOOKUP_REQUEST_KEY]: phoneNumbers,
  },
}).catch((error) => {
  this.logger.error(
    `DSS->lookupByPhoneNumbers#ERROR, Phone number lookup failure, ${error.message}`
  );
  return Promise.reject(error);
});
```

### 4.5 Client-Side Batching

For more than 5 phone numbers, clients must implement batching:

#### 4.5.1 Sequential Batching (with progress)

```javascript
async function lookupManySequential(phoneNumbers, onProgress) {
  const chunkSize = 5;
  const allResults = {
    resultArray: [],
    foundArray: [],
    notFoundArray: []
  };

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    const chunk = phoneNumbers.slice(i, i + chunkSize);
    
    const result = await webex.internal.dss.lookupByPhoneNumbers(chunk);

    allResults.resultArray.push(...result.resultArray);
    allResults.foundArray.push(...result.foundArray);
    allResults.notFoundArray.push(...result.notFoundArray);

    if (onProgress) {
      const progress = Math.min(100, ((i + chunkSize) / phoneNumbers.length) * 100);
      onProgress(progress);
    }
  }

  return allResults;
}
```

#### 4.5.2 Parallel Batching (faster)

```javascript
async function lookupManyParallel(phoneNumbers) {
  const chunkSize = 5;
  const chunks = [];

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    chunks.push(phoneNumbers.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map(chunk => webex.internal.dss.lookupByPhoneNumbers(chunk))
  );

  return {
    resultArray: results.flatMap(r => r.resultArray),
    foundArray: results.flatMap(r => r.foundArray),
    notFoundArray: results.flatMap(r => r.notFoundArray)
  };
}
```

### 4.6 Usage Examples

#### 4.6.1 Single Phone Number

```javascript
const result = await webex.internal.dss.lookupByPhoneNumbers(['+15551234567']);

if (result.foundArray.length > 0) {
  console.log('Contact found:', result.resultArray[0].displayName);
} else {
  console.log('Phone number not found');
}
```

#### 4.6.2 Multiple Phone Numbers (≤5)

```javascript
const result = await webex.internal.dss.lookupByPhoneNumbers([
  '+15551234567',
  '+442012345678',
  '+33123456789'
]);

console.log(`Found: ${result.foundArray.length}`);
console.log(`Not found: ${result.notFoundArray.length}`);
console.log('Entities:', result.resultArray);
```

#### 4.6.3 With Error Handling

```javascript
try {
  const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);
  
  // Process results
  result.resultArray.forEach(entity => {
    console.log(`${entity.displayName}: ${entity.phoneNumbers[0]}`);
  });
  
} catch (error) {
  if (error.name === 'DssTimeoutError') {
    console.error('Lookup timed out, please retry');
  } else if (error.message.includes('maximum of 5')) {
    console.error('Too many numbers, use batching');
  } else {
    console.error('Lookup failed:', error.message);
  }
}
```

---

## 5. API Reference

### 5.1 Registration Methods

#### 5.1.1 register()

Connects to Mercury and starts listening for DSS events.

```typescript
register(): Promise<void>
```

**Requirements:**
- SDK must be authorized (`webex.canAuthorize === true`)
- Device registration will be triggered if not already registered

**Example:**
```javascript
await webex.internal.dss.register();
console.log('DSS ready');
```

#### 5.1.2 unregister()

Disconnects from Mercury and stops listening for events.

```typescript
unregister(): Promise<void>
```

**Example:**
```javascript
await webex.internal.dss.unregister();
console.log('DSS disconnected');
```

### 5.2 Search Methods

#### 5.2.1 search()

Search for entities by query string.

```typescript
search(options: SearchOptions): Promise<any[]>
```

**Parameters:**
```typescript
interface SearchOptions {
  requestedTypes: SearchType[];  // ['PERSON', 'ROOM', 'ROBOT', etc.]
  queryString: string;           // Search query
  resultSize: number;            // Max results per provider
  includePersonalDevices?: boolean;
  includeCommonAreaPhones?: boolean;
  includeOnlyPairableDevices?: boolean;
}
```

**Returns:** Array of matched entities

**Example:**
```javascript
const results = await webex.internal.dss.search({
  requestedTypes: ['PERSON'],
  queryString: 'john',
  resultSize: 10
});
```

#### 5.2.2 searchPlaces()

Search for places and schedulable rooms.

```typescript
searchPlaces(options: SearchPlaceOptions): Promise<any[]>
```

**Parameters:**
```typescript
interface SearchPlaceOptions {
  queryString: string;
  resultSize: number;
  isOnlySchedulableRooms?: boolean;
}
```

### 5.3 Lookup Methods

#### 5.3.1 lookup()

Lookup entity by ID.

```typescript
lookup(options: LookupOptions): Promise<any | null>
```

**Parameters:**
```typescript
interface LookupOptions {
  id: string;
  entityProviderType?: string;
  shouldBatch?: boolean;  // Default: true
}
```

**Returns:** Entity object or null if not found

#### 5.3.2 lookupDetail()

Get detailed information about an entity.

```typescript
lookupDetail(options: LookupDetailOptions): Promise<any | null>
```

**Parameters:**
```typescript
interface LookupDetailOptions {
  id: string;
}
```

#### 5.3.3 lookupByEmail()

Lookup entity by email address.

```typescript
lookupByEmail(options: LookupByEmailOptions): Promise<any | null>
```

**Parameters:**
```typescript
interface LookupByEmailOptions {
  email: string;
}
```

**Example:**
```javascript
const entity = await webex.internal.dss.lookupByEmail({
  email: 'john.doe@example.com'
});
```

#### 5.3.4 lookupByPhoneNumbers() ⭐ NEW

Lookup entities by phone numbers (max 5).

```typescript
lookupByPhoneNumbers(phoneNumbers: string[]): Promise<RequestResult>
```

**Parameters:**
- `phoneNumbers: string[]` - Array of phone numbers in E.164 format (max 5)

**Returns:**
```typescript
{
  resultArray: any[];       // Matched entities
  foundArray: string[];     // Phone numbers found
  notFoundArray: string[];  // Phone numbers not found
}
```

**Throws:**
- `Error` - When more than 5 phone numbers provided
- `DssTimeoutError` - When server doesn't respond within timeout

**Example:**
```javascript
const result = await webex.internal.dss.lookupByPhoneNumbers([
  '+15551234567',
  '+442012345678'
]);
```

---

## 6. Error Handling

### 6.1 Error Types

#### 6.1.1 DssTimeoutError

Thrown when backend doesn't respond within configured timeout.

```typescript
class DssTimeoutError extends Error {
  requestId: string;
  timeout: number;
  resource: string;
  params: any;
}
```

**Message Format:**
```
The DSS did not respond within 10000 ms.
 Request Id: abc123...
 Resource: /lookup/orgid/.../phonenumbers
 Params: {"lookupValues":["+15551234567"]}
```

**Handling:**
```javascript
try {
  const result = await webex.internal.dss.lookupByPhoneNumbers(phones);
} catch (error) {
  if (error.name === 'DssTimeoutError') {
    // Retry with longer timeout
    webex.config.dss.requestTimeout = 30000;
    const result = await webex.internal.dss.lookupByPhoneNumbers(phones);
  }
}
```

#### 6.1.2 Validation Errors

**Empty Array:**
```javascript
// No error, returns empty result
const result = await webex.internal.dss.lookupByPhoneNumbers([]);
// { resultArray: [], foundArray: [], notFoundArray: [] }
```

**Max Limit Exceeded:**
```javascript
// Throws Error
const result = await webex.internal.dss.lookupByPhoneNumbers([
  '+1', '+2', '+3', '+4', '+5', '+6' // 6 numbers
]);
// Error: lookupByPhoneNumbers accepts a maximum of 5 phone numbers. 
// Received: 6. Please batch requests on the client side if needed.
```

### 6.2 Error Scenarios

| Scenario | Error Type | Handling |
|----------|------------|----------|
| SDK not authorized | Error: "SDK cannot authorize" | Ensure valid token/OAuth |
| Timeout | DssTimeoutError | Retry or increase timeout |
| >5 phone numbers | Error | Implement client-side batching |
| Network error | HTTP error | Retry with backoff |
| Malformed phone | None (in notFoundArray) | Backend validation |

### 6.3 Logging

The plugin logs errors following this pattern:

```javascript
// Validation errors
this.logger.error('DSS->lookupByPhoneNumbers#ERROR, Maximum of 5 phone numbers allowed, received: 6');

// Request failures
this.logger.error('DSS->lookupByPhoneNumbers#ERROR, Phone number lookup failure, Network timeout');

// Registration errors
this.logger.error('DSS->register#ERROR, Unable to register, SDK cannot authorize');
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Location:** `test/unit/spec/dss.ts`

#### 7.1.1 Phone Number Lookup Tests

| Test | Description | Verification |
|------|-------------|--------------|
| Empty array | Returns empty result | No network call made |
| Single number | Valid request format | Correct `_request()` parameters |
| Max limit (5) | Accepts exactly 5 | Single request sent |
| Exceeds limit (>5) | Rejects with error | Error message mentions limit |
| All found | Correct result structure | `foundArray` populated correctly |
| Mixed found/not found | Proper array population | Both arrays correct |
| All not found | Empty result array | `notFoundArray` populated |
| Multiple sequences | Out-of-order handling | Arrays concatenated correctly |
| Timeout | DssTimeoutError thrown | Timer management verified |
| Partial sequences | Timeout on missing | Missing sequence detected |

#### 7.1.2 Test Helpers

```javascript
// Create Mercury event
function createData(requestId, sequence, finished, dataPath, results) {
  const data = { requestId, sequence };
  if (finished) data.finished = true;
  set(data, dataPath, results);
  return { data };
}

// Simulate request
async function testMakeRequest({ method, resource, params, bodyParams }) {
  const requestId = 'randomid';
  const promise = webex.internal.dss[method](params);
  return { requestId, promise };
}
```

### 7.2 Integration Tests

**Location:** `test/integration/spec/dss.ts`

Tests with real Webex credentials and Mercury:

```javascript
describe('#lookupByPhoneNumbers', () => {
  it('should lookup phone numbers and get real Mercury responses', async () => {
    const result = await webex.internal.dss.lookupByPhoneNumbers([
      '+15551234567' // Actual org number
    ]);
    
    assert.isDefined(result);
    assert.isArray(result.resultArray);
    assert.isArray(result.foundArray);
    assert.isArray(result.notFoundArray);
  });
});
```

### 7.3 Manual Testing

**Script:** `test/integration/spec/manual-phone-lookup-test.js`

Interactive CLI tool for testing:

```bash
# Single number
node test/integration/spec/manual-phone-lookup-test.js +15551234567

# Multiple numbers
node test/integration/spec/manual-phone-lookup-test.js +15551234567 +442012345678

# With debug output
DEBUG=true node test/integration/spec/manual-phone-lookup-test.js +15551234567
```

---

## 8. Security & Privacy

### 8.1 Phone Number Masking

**Requirement:** Mask phone numbers in logs to protect PII.

```javascript
// ❌ Bad - logs full number
console.log(`Looking up: ${phoneNumber}`);

// ✅ Good - masks all but last 4 digits
function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  return '****' + phone.slice(-4);
}
console.log(`Looking up: ${maskPhone(phoneNumber)}`);
```

### 8.2 Token Scopes

Required OAuth scopes:
- `spark:people_read` - Required for directory lookups

**Verification:**
```javascript
if (!webex.canAuthorize) {
  throw new Error('SDK cannot authorize - check token scopes');
}
```

### 8.3 Data Retention

**Guidelines:**
- Do not cache PII longer than necessary
- Clear contact data on logout
- Use encrypted storage if caching required
- Implement TTL for cached results

### 8.4 Compliance

**Considerations:**
- Obtain user consent for directory lookups if required by region
- Follow data privacy regulations (GDPR, CCPA, etc.)
- Implement audit logging for compliance tracking
- Document data flows for privacy impact assessments

---

## Appendix A: Constants Reference

**File:** `src/constants.ts`

```javascript
// Event names
export const DSS_LOOKUP_MERCURY_EVENT = 'event:directory.lookup';
export const DSS_SEARCH_MERCURY_EVENT = 'event:directory.search';
export const DSS_REGISTERED = 'dss:registered';
export const DSS_UNREGISTERED = 'dss:unregistered';
export const DSS_LOOKUP_RESULT = 'dss:lookupResult';
export const DSS_RESULT = 'dss:result';

// Service name
export const DSS_SERVICE_NAME = 'directoryservice';

// Data paths
export const LOOKUP_DATA_PATH = 'lookupResult.entities';
export const LOOKUP_FOUND_PATH = 'lookupResult.entitiesFound';
export const LOOKUP_NOT_FOUND_PATH = 'lookupResult.entitiesNotFound';
export const LOOKUP_REQUEST_KEY = 'lookupValues';
export const SEARCH_DATA_PATH = 'directoryEntities';
```

---

## Appendix B: Configuration

**Default Configuration:**

```javascript
{
  dss: {
    requestTimeout: 10000  // 10 seconds
  }
}
```

**Customization:**

```javascript
webex.config.dss.requestTimeout = 30000; // 30 seconds
```

---

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Maintainers:** Webex JS SDK Team
