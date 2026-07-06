# Contracts Catalog — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Exact language-native API names/types remain authoritative in `src/index.ts`, `src/api.ts`, and `src/Events/types.ts`.

### Exported API & Types

The rows below are generated from the actual `src/index.ts` export list. Internal package collaborators are cataloged separately and are not semver promises to package consumers.

| Contract ID | Owner module/package | Symbol | Signature / kind | Purpose | Stability / deprecation | Native definition | Exported at |
|---|---|---|---|---|---|---|---|
| export.createclient | `CallingClient` | `createClient` | `createClient(webex, config?): Promise<ICallingClient>` | Top-level calling-client factory. | Semver-controlled | `src/CallingClient/CallingClient.ts` | `src/index.ts` |
| export.createcallhistoryclient | `CallHistory` | `createCallHistoryClient` | `createCallHistoryClient(webex, logger): ICallHistory` | Call-history client factory. | Semver-controlled | `src/CallHistory/CallHistory.ts` | `src/index.ts` |
| export.createcallsettingsclient | `CallSettings` | `createCallSettingsClient` | `createCallSettingsClient(webex, logger, useProdWebexApis?): ICallSettings` | Call-settings client factory. | Semver-controlled | `src/CallSettings/CallSettings.ts` | `src/index.ts` |
| export.createcontactsclient | `Contacts` | `createContactsClient` | `createContactsClient(webex, logger): IContacts` | Contacts client factory. | Semver-controlled | `src/Contacts/ContactsClient.ts` | `src/index.ts` |
| export.createmicrophonestream | `@webex/media-helpers` | `createMicrophoneStream` | media-helper factory | Public microphone/media helper surface re-exported by the package. | Semver-controlled | external `@webex/media-helpers` | `src/index.ts` |
| export.createvoicemailclient | `Voicemail` | `createVoicemailClient` | `createVoicemailClient(webex, logger): IVoicemail` | Voicemail client factory. | Semver-controlled | `src/Voicemail/Voicemail.ts` | `src/index.ts` |
| export.createcallrecordingclient | `CallRecording` | `createCallRecordingClient` | `createCallRecordingClient(webex, logger): ICallRecording` | Call-recording client factory. | Semver-controlled | `src/CallRecording/CallRecording.ts` | `src/index.ts` |
| export.logger | `Logger` | `Logger` | language-native export | Public package type/value `Logger`. | Semver-controlled | `src/Logger/index.ts` | `src/index.ts` |
| export.noisereductioneffect | `@webex/media-helpers` | `NoiseReductionEffect` | language-native export | Public microphone/media helper surface re-exported by the package. | Semver-controlled | external `@webex/media-helpers` | `src/index.ts` |
| export.error-layer | `Errors` | `ERROR_LAYER` | language-native export | Public typed error contract `ERROR_LAYER`. | Semver-controlled | `src/Errors/types.ts` | `src/index.ts` |
| export.error-type | `Errors` | `ERROR_TYPE` | language-native export | Public typed error contract `ERROR_TYPE`. | Semver-controlled | `src/Errors/types.ts` | `src/index.ts` |
| export.icallingclient | `CallingClient` | `ICallingClient` | language-native export | Public TypeScript interface `ICallingClient`. | Semver-controlled | `src/CallingClient/types.ts` | `src/index.ts` |
| export.icallhistory | `CallHistory` | `ICallHistory` | language-native export | Public TypeScript interface `ICallHistory`. | Semver-controlled | `src/CallHistory/types.ts` | `src/index.ts` |
| export.janusresponseevent | `CallHistory` | `JanusResponseEvent` | language-native export | Public event key or payload contract `JanusResponseEvent`. | Semver-controlled | `src/CallHistory/types.ts` | `src/index.ts` |
| export.icallrecording | `CallRecording` | `ICallRecording` | language-native export | Public TypeScript interface `ICallRecording`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recording | `CallRecording` | `Recording` | language-native export | Public call-recording contract `Recording`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordinglistresponse | `CallRecording` | `RecordingListResponse` | language-native export | Public call-recording contract `RecordingListResponse`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingmetadata | `CallRecording` | `RecordingMetadata` | language-native export | Public call-recording contract `RecordingMetadata`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingmetadataresponse | `CallRecording` | `RecordingMetadataResponse` | language-native export | Public call-recording contract `RecordingMetadataResponse`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingresponse | `CallRecording` | `RecordingResponse` | language-native export | Public call-recording contract `RecordingResponse`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingstatus | `CallRecording` | `RecordingStatus` | language-native export | Public call-recording contract `RecordingStatus`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingdeleteresponse | `CallRecording` | `RecordingDeleteResponse` | language-native export | Public call-recording contract `RecordingDeleteResponse`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.deleterecordingoptions | `CallRecording` | `DeleteRecordingOptions` | language-native export | Public call-recording contract `DeleteRecordingOptions`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.getrecordingsoptions | `CallRecording` | `GetRecordingsOptions` | language-native export | Public call-recording contract `GetRecordingsOptions`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingrequesttype | `CallRecording` | `RecordingRequestType` | language-native export | Public call-recording contract `RecordingRequestType`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.getcallrecordingrequest | `CallRecording` | `GetCallRecordingRequest` | language-native export | Public call-recording contract `GetCallRecordingRequest`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.recordingresponsefor | `CallRecording` | `RecordingResponseFor` | language-native export | Public call-recording contract `RecordingResponseFor`. | Semver-controlled | `src/CallRecording/types.ts` | `src/index.ts` |
| export.getremoteparty | `CallRecording` | `getRemoteParty` | recording-party utility | Resolve a recording party into its normalized remote-party representation. | Semver-controlled | `src/CallRecording/utils.ts` | `src/index.ts` |
| export.callforwardsetting | `CallSettings` | `CallForwardSetting` | language-native export | Public package type/value `CallForwardSetting`. | Semver-controlled | `src/CallSettings/types.ts` | `src/index.ts` |
| export.callforwardalwayssetting | `CallSettings` | `CallForwardAlwaysSetting` | language-native export | Public package type/value `CallForwardAlwaysSetting`. | Semver-controlled | `src/CallSettings/types.ts` | `src/index.ts` |
| export.callsettingresponse | `CallSettings` | `CallSettingResponse` | language-native export | Public package type/value `CallSettingResponse`. | Semver-controlled | `src/CallSettings/types.ts` | `src/index.ts` |
| export.icallsettings | `CallSettings` | `ICallSettings` | language-native export | Public TypeScript interface `ICallSettings`. | Semver-controlled | `src/CallSettings/types.ts` | `src/index.ts` |
| export.togglesetting | `CallSettings` | `ToggleSetting` | language-native export | Public package type/value `ToggleSetting`. | Semver-controlled | `src/CallSettings/types.ts` | `src/index.ts` |
| export.voicemailsetting | `CallSettings` | `VoicemailSetting` | language-native export | Public package type/value `VoicemailSetting`. | Semver-controlled | `src/CallSettings/types.ts` | `src/index.ts` |
| export.contact | `Contacts` | `Contact` | language-native export | Public package type/value `Contact`. | Semver-controlled | `src/Contacts/types.ts` | `src/index.ts` |
| export.contactresponse | `Contacts` | `ContactResponse` | language-native export | Public package type/value `ContactResponse`. | Semver-controlled | `src/Contacts/types.ts` | `src/index.ts` |
| export.grouptype | `Contacts` | `GroupType` | language-native export | Public package type/value `GroupType`. | Semver-controlled | `src/Contacts/types.ts` | `src/index.ts` |
| export.icontacts | `Contacts` | `IContacts` | language-native export | Public TypeScript interface `IContacts`. | Semver-controlled | `src/Contacts/types.ts` | `src/index.ts` |
| export.ivoicemail | `Voicemail` | `IVoicemail` | language-native export | Public TypeScript interface `IVoicemail`. | Semver-controlled | `src/Voicemail/types.ts` | `src/index.ts` |
| export.summaryinfo | `Voicemail` | `SummaryInfo` | language-native export | Public package type/value `SummaryInfo`. | Semver-controlled | `src/Voicemail/types.ts` | `src/index.ts` |
| export.voicemailresponseevent | `Voicemail` | `VoicemailResponseEvent` | language-native export | Public event key or payload contract `VoicemailResponseEvent`. | Semver-controlled | `src/Voicemail/types.ts` | `src/index.ts` |
| export.iline | `CallingClient` | `ILine` | language-native export | Public TypeScript interface `ILine`. | Semver-controlled | `src/CallingClient/line/types.ts` | `src/index.ts` |
| export.line-events | `CallingClient` | `LINE_EVENTS` | language-native export | Public event key or payload contract `LINE_EVENTS`. | Semver-controlled | `src/CallingClient/line/types.ts` | `src/index.ts` |
| export.calling-client-event-keys | `Events` | `CALLING_CLIENT_EVENT_KEYS` | language-native export | Public event key or payload contract `CALLING_CLIENT_EVENT_KEYS`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.call-event-keys | `Events` | `CALL_EVENT_KEYS` | language-native export | Public event key or payload contract `CALL_EVENT_KEYS`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.calleriddisplay | `Events` | `CallerIdDisplay` | language-native export | Public package type/value `CallerIdDisplay`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.disposition | `Events` | `Disposition` | language-native export | Public package type/value `Disposition`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.line-event-keys | `Events` | `LINE_EVENT_KEYS` | language-native export | Public event key or payload contract `LINE_EVENT_KEYS`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.common-event-keys | `Events` | `COMMON_EVENT_KEYS` | language-native export | Public event key or payload contract `COMMON_EVENT_KEYS`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.mobius-socket-disconnect-reason | `Events` | `MOBIUS_SOCKET_DISCONNECT_REASON` | language-native export | Public package type/value `MOBIUS_SOCKET_DISCONNECT_REASON`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.mobiussocketdisconnectedevent | `Events` | `MobiusSocketDisconnectedEvent` | language-native export | Public event key or payload contract `MobiusSocketDisconnectedEvent`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.usersession | `Events` | `UserSession` | language-native export | Public package type/value `UserSession`. | Semver-controlled | `src/Events/types.ts` | `src/index.ts` |
| export.calldetails | `common` | `CallDetails` | language-native export | Public package type/value `CallDetails`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.calldirection | `common` | `CallDirection` | language-native export | Public package type/value `CallDirection`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.calltype | `common` | `CallType` | language-native export | Public package type/value `CallType`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.calling-backend | `common` | `CALLING_BACKEND` | language-native export | Public package type/value `CALLING_BACKEND`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.displayinformation | `common` | `DisplayInformation` | language-native export | Public package type/value `DisplayInformation`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.sort | `common` | `SORT` | language-native export | Public package type/value `SORT`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.sort-by | `common` | `SORT_BY` | language-native export | Public package type/value `SORT_BY`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |
| export.resolvecallingbackend | `common` | `resolveCallingBackend` | backend-resolution function | Resolve the active calling backend from SDK/device context. | Semver-controlled | `src/common/Utils.ts` | `src/index.ts` |
| export.wdmdevice | `SDKConnector` | `WDMDevice` | language-native export | Public package type/value `WDMDevice`. | Semver-controlled | `src/SDKConnector/types.ts` | `src/index.ts` |
| export.callerror | `Errors` | `CallError` | language-native export | Public typed error contract `CallError`. | Semver-controlled | `src/Errors/index.ts` | `src/index.ts` |
| export.lineerror | `Errors` | `LineError` | language-native export | Public typed error contract `LineError`. | Semver-controlled | `src/Errors/index.ts` | `src/index.ts` |
| export.icall | `CallingClient` | `ICall` | language-native export | Public TypeScript interface `ICall`. | Semver-controlled | `src/CallingClient/calling/types.ts` | `src/index.ts` |
| export.transfertype | `CallingClient` | `TransferType` | language-native export | Public package type/value `TransferType`. | Semver-controlled | `src/CallingClient/calling/types.ts` | `src/index.ts` |
| export.logger-level | `Logger` | `LOGGER` | language-native export | Public package type/value `LOGGER`. | Semver-controlled | `src/Logger/types.ts` | `src/index.ts` |
| export.localmicrophonestream | `@webex/media-helpers` | `LocalMicrophoneStream` | language-native export | Public microphone/media helper surface re-exported by the package. | Semver-controlled | external `@webex/media-helpers` | `src/index.ts` |
| export.callingclientconfig | `CallingClient` | `CallingClientConfig` | language-native export | Public package type/value `CallingClientConfig`. | Semver-controlled | `src/CallingClient/types.ts` | `src/index.ts` |
| export.serviceindicator | `common` | `ServiceIndicator` | language-native export | Public package type/value `ServiceIndicator`. | Semver-controlled | `src/common/types.ts` | `src/index.ts` |

### Events

| Contract ID | Owner module | Event/topic family | Direction | Payload/key source | Delivery guarantees | Compatibility | Exported at |
|---|---|---|---|---|---|---|---|
| events.calling-client | `CallingClient` | `CALLING_CLIENT_EVENT_KEYS` | publish | `src/Events/types.ts` | synchronous EventEmitter callback after module state update | enum values/payload types are semver-sensitive | `src/index.ts` |
| events.call | `CallingClient/calling` | `CALL_EVENT_KEYS` | publish | `src/Events/types.ts` | synchronous EventEmitter callback; remote ordering follows Mobius/ROAP | enum values/payload types are semver-sensitive | `src/index.ts` |
| events.line | `CallingClient/line` | `LINE_EVENTS`, `LINE_EVENT_KEYS` | publish | `src/CallingClient/line/types.ts`; `src/Events/types.ts` | synchronous EventEmitter callback after line/registration transition | enum values/payload types are semver-sensitive | `src/index.ts` |
| events.common | `CallHistory`, `CallRecording`, `Voicemail` | `COMMON_EVENT_KEYS` | publish/consume | `src/Events/types.ts` | remote delivery/order follows Mercury; local forwarding is synchronous | enum values/payload types are semver-sensitive | `src/index.ts` |
| events.mobius-disconnect | `mobius-socket` integration | `MOBIUS_SOCKET_DISCONNECT_REASON`, `MobiusSocketDisconnectedEvent` | publish | `src/Events/types.ts` | emitted through CallingClient integration, not a public MobiusSocket class | additive payload evolution only | `src/index.ts` |

### Internal Package Surfaces

These are cross-module implementation contracts. They are not exported from `src/index.ts` and are not package-consumer semver surfaces.

| Contract ID | Owner | Internal surface | Used by | Defined at | Stability |
|---|---|---|---|---|---|
| internal.sdk-connector | `SDKConnector` | frozen singleton: `setWebex`, `get`, `getWebex`, `request`, Mercury listener bridge | calling package modules | `src/SDKConnector/index.ts` | internal; coordinate package-wide changes |
| internal.metric-manager | `Metrics` | `getMetricManager` / `IMetricManager` submissions | CallingClient, Registration, Call, Voicemail | `src/Metrics/index.ts`; `src/Metrics/types.ts` | internal; metric contracts remain operationally sensitive |
| internal.caller-id | `CallingClient/calling/CallerId` | `createCallerId` / `ICallerId` | `Call` | `src/CallingClient/calling/CallerId/index.ts`; `types.ts` | internal |
| internal.call-manager | `CallingClient/calling` | `getCallManager` / `ICallManager` | CallingClient, Line, Registration | `src/CallingClient/calling/callManager.ts`; `types.ts` | internal |
| internal.registration | `CallingClient/registration` | `Registration` / `IRegistration` | Line, CallingClient | `src/CallingClient/registration/index.ts`; `types.ts` | internal |
| internal.mobius-socket | `mobius-socket` | `getMobiusSocketInstance`, `MobiusSocket`, reset and transport events | APIRequest / CallingClient | `src/mobius-socket/index.ts`; `mobius-socket.ts` | internal; only disconnect enum/payload types are re-exported |

## Requires — what this repo depends on

| Dependency | What is consumed | Detail link | Availability assumption | Fallback on failure | Version floor |
|---|---|---|---|---|---|
| Webex request client and Janus call-history APIs | Consumed by `src/CallHistory/` | [`src/CallHistory/ai-docs/call-history-spec.md`](../src/CallHistory/ai-docs/call-history-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Mercury real-time events | Consumed by `src/CallHistory/` | [`src/CallHistory/ai-docs/call-history-spec.md`](../src/CallHistory/ai-docs/call-history-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| UCM Lines API for line enrichment | Consumed by `src/CallHistory/` | [`src/CallHistory/ai-docs/call-history-spec.md`](../src/CallHistory/ai-docs/call-history-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex hydraDeveloperApi recording endpoints | Consumed by `src/CallRecording/` | [`src/CallRecording/ai-docs/call-recording-spec.md`](../src/CallRecording/ai-docs/call-recording-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Mercury recording lifecycle events | Consumed by `src/CallRecording/` | [`src/CallRecording/ai-docs/call-recording-spec.md`](../src/CallRecording/ai-docs/call-recording-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Calling-backend resolution | Consumed by `src/CallRecording/` | [`src/CallRecording/ai-docs/call-recording-spec.md`](../src/CallRecording/ai-docs/call-recording-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex Calling XSI/Hydra services | Consumed by `src/CallSettings/` | [`src/CallSettings/ai-docs/call-settings-spec.md`](../src/CallSettings/ai-docs/call-settings-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| UCM management gateway | Consumed by `src/CallSettings/` | [`src/CallSettings/ai-docs/call-settings-spec.md`](../src/CallSettings/ai-docs/call-settings-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Calling-backend resolution | Consumed by `src/CallSettings/` | [`src/CallSettings/ai-docs/call-settings-spec.md`](../src/CallSettings/ai-docs/call-settings-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| SDKConnector and Webex device/feature/service plugins | Consumed by `src/CallingClient/` | [`src/CallingClient/ai-docs/calling-client-spec.md`](../src/CallingClient/ai-docs/calling-client-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Calling, Line, Registration, Metrics, and mobius-socket modules | Consumed by `src/CallingClient/` | [`src/CallingClient/ai-docs/calling-client-spec.md`](../src/CallingClient/ai-docs/calling-client-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| WebRTC media helpers | Consumed by `src/CallingClient/` | [`src/CallingClient/ai-docs/calling-client-spec.md`](../src/CallingClient/ai-docs/calling-client-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Mobius signaling through APIRequest | Consumed by `src/CallingClient/calling/` | [`src/CallingClient/calling/ai-docs/calling-spec.md`](../src/CallingClient/calling/ai-docs/calling-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| @webex/internal-media-core ROAP/media engine | Consumed by `src/CallingClient/calling/` | [`src/CallingClient/calling/ai-docs/calling-spec.md`](../src/CallingClient/calling/ai-docs/calling-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| CallerId, Metrics, Logger, and SDKConnector | Consumed by `src/CallingClient/calling/` | [`src/CallingClient/calling/ai-docs/calling-spec.md`](../src/CallingClient/calling/ai-docs/calling-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Mobius SIP-style identity headers | Consumed by `src/CallingClient/calling/CallerId/` | [`src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md`](../src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| SCIM people lookup through the Webex SDK | Consumed by `src/CallingClient/calling/CallerId/` | [`src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md`](../src/CallingClient/calling/CallerId/ai-docs/caller-id-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Registration and Calling submodules | Consumed by `src/CallingClient/line/` | [`src/CallingClient/line/ai-docs/line-spec.md`](../src/CallingClient/line/ai-docs/line-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| SDKConnector event bridge | Consumed by `src/CallingClient/line/` | [`src/CallingClient/line/ai-docs/line-spec.md`](../src/CallingClient/line/ai-docs/line-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Mobius registration APIs through APIRequest | Consumed by `src/CallingClient/registration/` | [`src/CallingClient/registration/ai-docs/registration-spec.md`](../src/CallingClient/registration/ai-docs/registration-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Web Worker keepalive timer | Consumed by `src/CallingClient/registration/` | [`src/CallingClient/registration/ai-docs/registration-spec.md`](../src/CallingClient/registration/ai-docs/registration-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex bounded storage and metrics | Consumed by `src/CallingClient/registration/` | [`src/CallingClient/registration/ai-docs/registration-spec.md`](../src/CallingClient/registration/ai-docs/registration-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex contacts service | Consumed by `src/Contacts/` | [`src/Contacts/ai-docs/contacts-spec.md`](../src/Contacts/ai-docs/contacts-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex KMS encryption | Consumed by `src/Contacts/` | [`src/Contacts/ai-docs/contacts-spec.md`](../src/Contacts/ai-docs/contacts-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| SCIM people lookup | Consumed by `src/Contacts/` | [`src/Contacts/ai-docs/contacts-spec.md`](../src/Contacts/ai-docs/contacts-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| @webex/internal-plugin-metrics through Webex SDK | Consumed by `src/Metrics/` | [`src/Metrics/ai-docs/metrics-spec.md`](../src/Metrics/ai-docs/metrics-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Calling error/event types | Consumed by `src/Metrics/` | [`src/Metrics/ai-docs/metrics-spec.md`](../src/Metrics/ai-docs/metrics-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Initialized and authorized WebexSDK instance with Mercury | Consumed by `src/SDKConnector/` | [`src/SDKConnector/ai-docs/sdk-connector-spec.md`](../src/SDKConnector/ai-docs/sdk-connector-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex Calling, BroadWorks, and UCM voicemail services | Consumed by `src/Voicemail/` | [`src/Voicemail/ai-docs/voicemail-spec.md`](../src/Voicemail/ai-docs/voicemail-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Contacts resolution and Metrics | Consumed by `src/Voicemail/` | [`src/Voicemail/ai-docs/voicemail-spec.md`](../src/Voicemail/ai-docs/voicemail-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| WebSocket implementation | Consumed by `src/mobius-socket/` | [`src/mobius-socket/ai-docs/mobius-socket-spec.md`](../src/mobius-socket/ai-docs/mobius-socket-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |
| Webex credentials, device feature settings, and Mobius discovery | Consumed by `src/mobius-socket/` | [`src/mobius-socket/ai-docs/mobius-socket-spec.md`](../src/mobius-socket/ai-docs/mobius-socket-spec.md) | Remote/service availability or package compatibility | Owning module retry/fallback/error behavior | `packages/calling/package.json` or Webex service contract |

## Compatibility & Deprecation Policy

- Public exports, factory signatures, interfaces, event names, and payload fields are semver-sensitive.
- Additive optional fields are preferred. Breaking removals/renames require an approved major-version transition and changelog/deprecation plan.
- Native TypeScript declarations remain the exact API source; this catalog and module specs summarize and route to them.

## Detailed Interface Docs

- Package exports: `src/index.ts`; TypeDoc exports: `src/api.ts`; event payloads: `src/Events/types.ts`.
- Operation behavior, errors, backend support, and sequencing live in each owning module specification.

## Maintenance

- Update this catalog, the owning module spec, `src/index.ts`/native declarations, and `.sdd/manifest.json` in the same change when a public surface changes.
