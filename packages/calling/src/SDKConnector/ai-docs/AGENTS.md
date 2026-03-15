# SDKConnector Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

- **First step:** Load the package-level patterns at `packages/calling/ai-docs/patterns/` — especially [architecture-patterns.md](../../../ai-docs/patterns/architecture-patterns.md) for the singleton pattern.
- **Context:** SDKConnector is a foundational infrastructure module used by every other module in the package. Changes here have wide-reaching impact.
- **For consumer context:** See [CallingClient/ai-docs/AGENTS.md](../../CallingClient/ai-docs/AGENTS.md) — CallingClient is the primary consumer that calls `setWebex()`.

---

## Overview

`SDKConnector` is a **frozen singleton** that acts as the bridge between the calling SDK and the Webex SDK. It wraps the Webex SDK instance and provides a controlled interface for making HTTP requests and registering/unregistering Mercury WebSocket event listeners.

Every module in the calling package — `CallingClient`, `CallManager`, `Call`, `Line`, `Registration`, `CallHistory`, `CallSettings`, `Contacts`, `Voicemail` — depends on `SDKConnector` to access the Webex SDK.

**File:** `packages/calling/src/SDKConnector/index.ts`

**Export:** `export default Object.freeze(new SDKConnector())`

---

## Purpose

The SDKConnector module provides:

- **Singleton Webex SDK access** — Ensures the entire calling package uses a single Webex SDK instance
- **Set-once semantics** — `setWebex()` can only be called once; subsequent calls throw an error
- **Validation** — Validates the Webex SDK instance before accepting it (authorization, readiness, Mercury availability)
- **HTTP request proxy** — `request<T>()` delegates to `webex.request()`
- **Mercury listener management** — `registerListener()` / `unregisterListener()` for WebSocket events

---

## Public API

### ISDKConnector Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `setWebex` | `(webexInstance: WebexSDK): void` | Sets the Webex SDK instance. Throws if called more than once or if validation fails. |
| `getWebex` | `(): WebexSDK` | Returns the stored Webex SDK instance |
| `get` | `(): ISDKConnector` | Returns the SDKConnector singleton instance |
| `registerListener` | `<T>(event: string, cb: (data?: T) => unknown): void` | Registers a callback on Mercury WebSocket for the given event |
| `unregisterListener` | `(event: string): void` | Removes the listener for the given Mercury event |

### Additional Method (on class, not on interface)

| Method | Signature | Description |
|--------|-----------|-------------|
| `request` | `<T>(request: WebexRequestPayload): Promise<T>` | Proxies an HTTP request through `webex.request()` |

---

## Singleton Pattern

SDKConnector uses a module-level singleton with `Object.freeze()`:

```typescript
let instance: ISDKConnector;
let webex: WebexSDK;

class SDKConnector implements ISDKConnector {
  public setWebex(webexInstance: WebexSDK): void {
    if (instance) {
      throw new Error('You cannot set the SDKConnector instance more than once');
    }
    const {error, success} = validateWebex(webexInstance);
    if (error) throw error;
    if (success) webex = webexInstance;
    instance = this;
  }

  public get(): ISDKConnector { return instance; }
  public getWebex(): WebexSDK { return webex; }

  public request<T>(request: WebexRequestPayload): Promise<T> {
    return instance.getWebex().request(request);
  }

  public registerListener<T>(event: string, cb: (data?: T) => void): void {
    instance.getWebex().internal.mercury.on(event, (data: T) => cb(data));
  }

  public unregisterListener(event: string): void {
    instance.getWebex().internal.mercury.off(event);
  }
}

export default Object.freeze(new SDKConnector());
```

Key characteristics:
- **Set once:** `setWebex()` stores the instance in a module-level `let` and rejects subsequent calls
- **Frozen export:** `Object.freeze()` prevents property modification on the exported object
- **Module-level closures:** `instance` and `webex` are private to the module, not on the class

---

## Validation

Before accepting a Webex SDK instance, `validateWebex()` checks three prerequisites:

```typescript
export const validateWebex = (webexInstance: WebexSDK) => {
  if (webexInstance.canAuthorize) {        // SDK can make authenticated requests
    if (webexInstance.ready) {              // SDK is fully initialized
      if (webexInstance.internal.mercury) { // Mercury WebSocket plugin is available
        return {error: undefined, success: true};
      }
      return {error: new Error('webex.internal.mercury is not available'), success: false};
    }
    return {error: new Error('webex.ready is not true'), success: false};
  }
  return {error: new Error('webex.canAuthorize is not true'), success: false};
};
```

| Check | Property | Failure Message |
|-------|----------|-----------------|
| Authorization | `webex.canAuthorize` | `'webex.canAuthorize is not true'` |
| Readiness | `webex.ready` | `'webex.ready is not true'` |
| Mercury | `webex.internal.mercury` | `'webex.internal.mercury is not available'` |

---

## Usage Patterns

### Initialization (done by CallingClient)

```typescript
import SDKConnector from '../SDKConnector';

// In constructor — set once
if (!this.sdkConnector.getWebex()) {
  SDKConnector.setWebex(webex);
}
this.webex = this.sdkConnector.getWebex();
```

### Making HTTP Requests

```typescript
const response = await this.webex.request({
  method: HTTP_METHODS.POST,
  uri: `${mobiusUrl}/${DEVICES_ENDPOINT_RESOURCE}`,
  headers: {
    'cisco-device-url': deviceUrl,
    'spark-user-agent': CALLING_USER_AGENT,
  },
  body: requestBody,
  service: ALLOWED_SERVICES.MOBIUS,
});
```

### Registering Mercury WebSocket Listeners

```typescript
// Register for Mobius call events
this.sdkConnector.registerListener<MobiusCallEvent>(
  'event:mobius',
  (event?: MobiusCallEvent) => {
    if (event) this.dequeueWsEvents(event);
  }
);

// Register for session events
this.sdkConnector.registerListener<CallSessionEvent>(
  'event:janus.user_recent_sessions',
  (event?: CallSessionEvent) => {
    if (event) this.emit(CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO, event);
  }
);
```

### Unregistering Listeners

```typescript
this.sdkConnector.unregisterListener('event:ucm.voicemail_download_complete');
```

---

## Consumers

SDKConnector is imported and used by every module in the package:

| Consumer | Usage |
|----------|-------|
| `CallingClient` | `setWebex()`, `registerListener()` for session events |
| `CallManager` | `getWebex()`, `registerListener()` for Mobius WebSocket events |
| `Call` | `getWebex()` for HTTP requests to Mobius call endpoints |
| `Line` | `getWebex()` for line-level operations |
| `Registration` | `setWebex()` fallback, `getWebex()` for device registration requests |
| `CallHistory` | `getWebex()`, `registerListener()` for session/viewed/deleted events |
| `CallSettings` | `getWebex()` for settings API calls |
| `Voicemail` | `getWebex()`, `registerListener()`/`unregisterListener()` for voicemail events |
| `Contacts` | `getWebex()` for contacts API calls |
| `CallerId` | `getWebex()` for caller ID resolution |
| `Utils` | `getWebex()` for log upload |

---

## WebexSDK Type

The `WebexSDK` interface defines the expected shape of the Webex SDK instance. It serves as the contract between the calling package and the Webex SDK.

### Top-Level Properties

| Property | Type | Description |
|----------|------|-------------|
| `version` | `string` | SDK version |
| `canAuthorize` | `boolean` | Whether the SDK can make authenticated requests |
| `ready` | `boolean` | Whether the SDK is fully initialized |
| `config.fedramp` | `boolean` | FedRAMP mode flag |
| `request` | `<T>(payload) => Promise<T>` | HTTP request method |
| `credentials.getUserToken` | `() => Promise<string>` | Access token retrieval |

### Internal Plugins (`webex.internal`)

| Plugin | Key Methods/Properties |
|--------|----------------------|
| `mercury` | `.on(event, cb)`, `.off(event)`, `.connected`, `.connecting` |
| `device` | `.url`, `.userId`, `.orgId`, `.callingBehavior`, `.features` |
| `services` | `._serviceUrls`, `.getMobiusClusters()`, `.fetchClientRegionInfo()`, `.get(service)` |
| `metrics` | `.submitClientMetrics(name, data)` |
| `encryption` | `.decryptText()`, `.encryptText()`, `.kms.*` |
| `support` | `.submitLogs(metadata, logs, options)` |

### Public Plugins

| Plugin | Key Methods |
|--------|------------|
| `logger` | `.log()`, `.error()`, `.warn()`, `.info()`, `.trace()`, `.debug()` |
| `people` | `.list(arg)` |
| `boundedStorage` | `.get()`, `.put()`, `.del()` — used for failover cache |

---

## Files

| File | Purpose |
|------|---------|
| `index.ts` | `SDKConnector` class and frozen singleton export |
| `types.ts` | `ISDKConnector`, `WebexSDK`, `ServiceHost`, `ClientRegionInfo`, `Logger` |
| `utils.ts` | `validateWebex()` — validation logic |
| `index.test.ts` | Unit tests (placeholder) |
| `utils.test.ts` | Validation utility tests (placeholder) |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Internal design, data flow, security considerations
- [Architecture Patterns](../../../ai-docs/patterns/architecture-patterns.md) — Singleton pattern
- [CallingClient AGENTS.md](../../CallingClient/ai-docs/AGENTS.md) — Primary consumer
- [Event Patterns](../../../ai-docs/patterns/event-patterns.md) — Mercury listener usage

---

_Last Updated: 2026-03-15_
