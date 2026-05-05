# CallSettings Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

Do **not** use this file as your only entry point for reasoning or code generation.

- **How to proceed:**
  - For changes within the `CallSettings/` directory, use this file as your primary reference.
  - For WXC-specific backend logic, refer to `WxCallBackendConnector.ts`.
  - For UCM-specific backend logic, refer to `UcmBackendConnector.ts`.
  - For backend detection logic (`getCallingBackEnd`), refer to `common/Utils.ts`.
- **Important:** Load this module-specific doc first, then drill into backend connector source files as needed.

---

## Overview

The `CallSettings` module provides APIs for retrieving and updating user call settings such as Call Waiting, Do Not Disturb (DND), Call Forwarding, Voicemail settings, and Call Forward Always. It uses a **strategy pattern** to delegate operations to backend-specific connectors based on the user's calling backend (WXC/Broadworks or UCM).

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/CallSettings/CallSettings.ts`

**Factory:** `createCallSettingsClient(webex, logger, useProdWebexApis?) -> ICallSettings`

---

### Key Capabilities

| Capability | Description |
| ----------- | ----------- |
| **Get Call Waiting** | Retrieves call waiting enabled/disabled status. WXC uses XSI Actions XML API via browser `fetch`. UCM returns 501 (not supported). |
| **Get/Set Do Not Disturb** | Reads or updates DND status via Hydra People API using `webex.request()` (WXC) or returns 501 (UCM). |
| **Get/Set Call Forwarding** | Reads or updates full call forwarding settings (always, busy, no answer, business continuity) via Hydra People API using `webex.request()` (WXC) or returns 501 (UCM). |
| **Get/Set Voicemail Settings** | Reads or updates voicemail configuration via Hydra People API using `webex.request()` (WXC) or returns 501 (UCM). |
| **Get Call Forward Always** | Composite API. WXC: checks call forwarding settings first; if CFA is enabled with a destination returns it, otherwise falls through to voicemail check (returns `VOICEMAIL` if `sendAllCalls.enabled`). UCM: queries Webex APIs and matches `directoryNumber` against `dn` or `e164Number` fields using `endsWith()`. |
| **Multi-Backend Support** | Automatically selects the correct backend connector (WXC/Broadworks or UCM) based on user entitlements via `getCallingBackEnd()`. |

---

## Public API

### ICallSettings Interface

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `getCallWaitingSetting` | `(): Promise<CallSettingResponse>` | Get call waiting status |
| `getDoNotDisturbSetting` | `(): Promise<CallSettingResponse>` | Get DND status |
| `setDoNotDisturbSetting` | `(flag: boolean): Promise<CallSettingResponse>` | Enable/disable DND |
| `getCallForwardSetting` | `(): Promise<CallSettingResponse>` | Get call forwarding settings |
| `setCallForwardSetting` | `(request: CallForwardSetting): Promise<CallSettingResponse>` | Update call forwarding settings |
| `getVoicemailSetting` | `(): Promise<CallSettingResponse>` | Get voicemail configuration |
| `setVoicemailSetting` | `(request: VoicemailSetting): Promise<CallSettingResponse>` | Update voicemail configuration |
| `getCallForwardAlwaysSetting` | `(directoryNumber?: string): Promise<CallSettingResponse>` | Get CFA status (destination or voicemail). `directoryNumber` required for UCM. |

### Key Types

#### CallSettingResponse

```typescript
type CallSettingResponse = {
  statusCode: number;
  data: {
    callSetting?: ToggleSetting | CallForwardSetting | VoicemailSetting | CallForwardAlwaysSetting;
    error?: string;
  };
  message: string | null;
};
```

#### ToggleSetting

```typescript
type ToggleSetting = {
  enabled: boolean;
  ringSplashEnabled?: boolean;
};
```

#### CallForwardAlwaysSetting

```typescript
type CallForwardAlwaysSetting = {
  enabled: boolean;
  ringReminderEnabled?: boolean;
  destinationVoicemailEnabled?: boolean;
  destination?: string; // Phone number or 'VOICEMAIL'
};
```

#### CallForwardSetting

```typescript
type CallForwardSetting = {
  callForwarding: {
    always: CallForwardAlwaysSetting;  // CFA settings
    busy: { enabled: boolean; destinationVoicemailEnabled?: boolean; destination?: string; };
    noAnswer: { enabled: boolean; numberOfRings?: number; destinationVoicemailEnabled?: boolean; destination?: string; };
  };
  businessContinuity: { enabled: boolean; destinationVoicemailEnabled?: boolean; destination?: string; };
};
```

#### VoicemailSetting

Contains `enabled`, `sendAllCalls`, `sendBusyCalls`, `sendUnansweredCalls`, `notifications`, `transferToNumber`, `emailCopyOfMessage`, `messageStorage`, and `faxMessage` configuration objects.

Key fields for CFA logic: `enabled` and `sendAllCalls.enabled` — when both are true, CFA is considered set to voicemail.

#### CallForwardingSettingsUCM (UCM-specific response type)

```typescript
type CallForwardingAlwaysSettingsUCM = {
  dn: string;                        // Directory number
  destination?: string;              // Forward destination
  destinationVoicemailEnabled: boolean;
  e164Number: string;                // E.164 formatted number
};

type CallForwardingSettingsUCM = {
  callForwarding: {
    always: CallForwardingAlwaysSettingsUCM[];  // Array (multiple lines)
  };
};
```

Note: The UCM response has `always` as an **array** (unlike WXC which has a single object), since UCM users can have multiple directory numbers.

---

## Configuration

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `webex` | `WebexSDK` | Yes | An initialized Webex SDK instance |
| `logger` | `LoggerInterface` | Yes | Logger interface with a `level` property |
| `useProdWebexApis` | `boolean` | No | For UCM: use production Webex APIs (default: `true`). Set to `false` for integration testing. |

---

## Examples and Use Cases

### Create a CallSettings Client

```typescript
import {createCallSettingsClient} from '@webex/calling';

const callSettings = createCallSettingsClient(webex, {level: 'info'});
```

### Get and Set DND

```typescript
const dndResponse = await callSettings.getDoNotDisturbSetting();
console.log('DND enabled:', dndResponse.data.callSetting?.enabled);

await callSettings.setDoNotDisturbSetting(true);
```

### Get Call Forward Always Status

```typescript
// WXC backend (no directoryNumber needed)
const cfaResponse = await callSettings.getCallForwardAlwaysSetting();

// UCM backend (directoryNumber required)
const cfaResponse = await callSettings.getCallForwardAlwaysSetting('1234');

if (cfaResponse.data.callSetting?.destination === 'VOICEMAIL') {
  console.log('CFA is set to voicemail');
}
```

### Update Call Forwarding

```typescript
const cfSettings = {
  callForwarding: {
    always: {enabled: true, destination: '+15551234567'},
    busy: {enabled: false},
    noAnswer: {enabled: true, numberOfRings: 4, destination: '+15559876543'},
  },
  businessContinuity: {enabled: false},
};

await callSettings.setCallForwardSetting(cfSettings);
```

---

## Implementation Notes

### HTTP Client Usage

| Method | Backend | HTTP Client | Auth Handling |
| ------ | ------- | ----------- | ------------- |
| `getCallWaitingSetting` | WXC | Browser `fetch` | Manual `Authorization` header via `getUserToken()` |
| `getDoNotDisturbSetting` | WXC | `this.webex.request()` | Automatic via SDK |
| `setDoNotDisturbSetting` | WXC | `this.webex.request()` | Automatic via SDK |
| `getCallForwardSetting` | WXC | `this.webex.request()` | Automatic via SDK |
| `setCallForwardSetting` | WXC | `this.webex.request()` | Automatic via SDK |
| `getVoicemailSetting` | WXC | `this.webex.request()` | Automatic via SDK |
| `setVoicemailSetting` | WXC | `this.webex.request()` | Automatic via SDK |
| `getCallForwardAlwaysSetting` | WXC | `this.webex.request()` (via CF/VM methods) | Automatic via SDK |
| `getCallForwardAlwaysSetting` | UCM | `this.webex.request()` | FedRAMP: manual `authorization` header; otherwise: implicit |

### ID Format Conversion (WXC)

The WXC connector converts raw device UUIDs to Hydra-format IDs at construction time:

```typescript
this.personId = inferIdFromUuid(this.webex.internal.device.userId, DecodeType.PEOPLE);
this.orgId = inferIdFromUuid(this.webex.internal.device.orgId, DecodeType.ORGANIZATION);
```

These Hydra-format IDs are used in all Hydra People API URLs.

### UCM API URL Selection

The UCM connector selects the Webex API base URL based on configuration:

| Condition | Base URL |
| --------- | -------- |
| `webex.config.fedramp === true` | `https://api-usgov.webex.com/v1/uc/config` |
| `useProdWebexApis === true` (default) | `https://webexapis.com/v1/uc/config` |
| `useProdWebexApis === false` | `https://integration.webexapis.com/v1/uc/config` |

### UCM Directory Number Matching

The UCM connector matches the provided `directoryNumber` against CFA entries using `endsWith()`:

```typescript
callForwarding.always.find(
  (item) => item.dn.endsWith(directoryNumber) || item.e164Number.endsWith(directoryNumber)
);
```

This allows partial matching (e.g., passing `'1234'` matches `'+15551234'`).

### UCM CF_ENDPOINT Lowercase

The UCM connector lowercases `CF_ENDPOINT` when constructing URLs:
- WXC uses: `features/callForwarding` (camelCase)
- UCM uses: `features/callforwarding` (lowercase, via `.toLowerCase()`)

---

## Dependencies

### Runtime Dependencies

| Package | Purpose |
| ------- | ------- |
| `webex` (SDK) | HTTP requests to Hydra API, XSI Actions API, Webex APIs |

### Internal Dependencies

| Module | Purpose |
| ------ | ------- |
| `SDKConnector` | Singleton bridge to Webex SDK |
| `Logger` | Structured logging with file/method context |
| `getCallingBackEnd` | Determines calling backend (WXC, UCM, BWRKS) |
| `getXsiActionEndpoint` | Resolves XSI Actions endpoint for call waiting (lazy, cached after first call) |
| `inferIdFromUuid` | Converts device userId/orgId to Hydra-format IDs (`DecodeType.PEOPLE`, `DecodeType.ORGANIZATION`) |
| `serviceErrorCodeHandler` | Standardized error response formatting |
| `uploadLogs` | Uploads diagnostic logs on error |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams
