# DSS Mercury Response Structure & Parser

This document explains how the `internal-plugin-dss` consumes directory search and lookup results sent over Mercury, how the plugin's parser aggregates sequences, and defines the TypeScript interfaces representing the final resolved responses returned by `search()` and `lookup()`.

## 1. How the parser works (summary)
- The plugin issues a POST to the directory service with a generated `requestId` and request parameters in the body.
- The backend streams zero-or-more Mercury events with event names `event:directory.search` or `event:directory.lookup` depending on the request.
- Each Mercury payload contains: `requestId`, `sequence` (integer), optional `finished` flag, and a payload field containing the results (path differs for search vs lookup).
- The plugin listens for events matching the internal event name `dss:result<requestId>` (constructed from `DSS_RESULT + requestId`) and accumulates `resultData` per sequence.
- When an event with `finished: true` is received, the plugin computes the expected sequence indices (0..sequence) and waits until events for all indices arrive. It then concatenates per-sequence result arrays in sequence order and returns the aggregated array.

## 2. Event payload shapes (observed in tests)

The test harness constructs events via helper `createData(requestId, sequence, finished, dataPath, results)` which results in Mercury envelopes like:

Search event example (directoryEntities):

```json
{
  "data": {
    "requestId": "randomid",
    "sequence": 1,
    "directoryEntities": [ { /* entity objects */ } ]
  }
}
```

Lookup event example (lookupResult):

```json
{
  "data": {
    "requestId": "randomid",
    "sequence": 0,
    "finished": true,
    "lookupResult": {
      "entities": [ /* entities array */ ],
      "entitiesFound": [ /* keys of found items */ ],
      "entitiesNotFound": [ /* keys of not found items */ ]
    }
  }
}
```

Notes observed in tests:
- `directoryEntities` is the data path used for `search()` results (constant `SEARCH_DATA_PATH`).
- For lookup flows, `lookupResult.entities`, `lookupResult.entitiesFound`, and `lookupResult.entitiesNotFound` are used.
- The test utilities sometimes omit `entitiesNotFound` when not present.

## 3. Parser contract (what the plugin expects)
- Each event must include `requestId` and `sequence`.
- Exactly one event will have `finished: true`. The `sequence` on that event denotes the highest index emitted; expected indices are `0..sequence` inclusive.
- Events may arrive out-of-order; plugin stores per-index result arrays and concatenates in index order when all sequences present.
- If the plugin's timer (configured by `this.config.requestTimeout`) elapses before all expected sequences are received, it rejects with `DssTimeoutError`.

## 4. Final response shapes

The plugin returns an object shaped according to `RequestResult` (see `packages/@webex/internal-plugin-dss/src/types.ts`). We define TypeScript-friendly interfaces below.

```ts
// Generic result from internal _request
export interface DssRequestResult<T = any> {
  resultArray: T[];          // concatenated array of entities (ordered by sequence index)
  foundArray?: any[];        // for lookups: array matching found keys in order of sequences
  notFoundArray?: any[];     // for lookups with notFoundPath
}

// For search()
export type DssSearchResult = DssRequestResult<DirectoryEntity>;

// For lookup()/lookupByEmail()/lookupDetail()
export type DssLookupResult = DssRequestResult<LookupEntity>;

// Example entity - flexible based on backend provider; normalize at SDK boundary as needed
export interface DirectoryEntity {
  id?: string;
  displayName?: string;
  emails?: string[];
  phoneNumbers?: string[];
  type?: string; // e.g., PERSON, ROOM, ROBOT
  [key: string]: any; // plugin treats entity as opaque beyond paths
}

export interface LookupEntity extends DirectoryEntity {}
```

Important: Entities are provider-dependent. The SDK exposes them as parsed JSON objects; consumers should not assume a rigid shape beyond common fields (id, displayName, emails, phoneNumbers), unless normalized by SDK code.

## 5. Example end-to-end (sequence of Mercury events)

1. Client calls `search({queryString: '838'})` — SDK sends POST body `{ requestId: "randomid", queryString: '838', ... }`.
2. Server emits events (order may vary):

Event A (sequence:1, finished:false):
```json
{ "data": { "requestId": "randomid", "sequence": 1, "directoryEntities": ["data1"] } }
```

Event B (sequence:2, finished:true):
```json
{ "data": { "requestId": "randomid", "sequence": 2, "finished": true, "directoryEntities": ["data2"] } }
```

Event C (sequence:0, finished:false):
```json
{ "data": { "requestId": "randomid", "sequence": 0, "directoryEntities": ["data0"] } }
```

SDK accumulates these into resultArray: ["data0", "data1", "data2"] and resolves the search Promise.

## 6. Errors and edge cases
- If the server never sends `finished: true`, plugin will timeout.
- If server sends `finished: true` with `sequence: N` but some indices never arrive, plugin will timeout.
- If server sends duplicate sequence numbers, last seen will be used (plugin currently overwrites per `result[data.sequence] = ...`).

## 7. Recommendations for SDK consumers
- Treat returned entities as flexible objects. Map and normalize fields you need.
- For phone lookups, expect phone numbers in provider-specific fields (e.g., `phoneNumbers`) and normalize on client if necessary.
- When building unit tests, simulate Mercury events by emitting `event:directory.search`/`event:directory.lookup` with `requestId` and `sequence` fields, matching test patterns in `packages/@webex/internal-plugin-dss/test/unit/spec/dss.ts`.

## 8. Appendix — helper test function used in unit tests

The tests use `createData(requestId, sequence, finished, dataPath, results)` which constructs an envelope `{data}` where `data` includes `requestId`, `sequence`, optional `finished`, and sets `results` nested at `dataPath` using `lodash.set`.

Example creation in tests: `createData(requestId, 0, true, 'lookupResult', {entities: ['data0'], entitiesFound: ['id0']})`.
