# Disable WebRTC Registration Config - Detailed Spec

## Objective

Add a Contact Center SDK configuration flag, `disableWebRTCRegistration`, read from `Webex.init({ config: { cc: ... }})`, to control whether Mobius/WebRTC registration is performed for browser login flows.

This preserves existing behavior by default and allows consumers to explicitly disable WebRTC registration when needed.

## Configuration Contract

### Input location

The flag is provided through:

`Webex.init({ config: { cc: { disableWebRTCRegistration: true }}})`

### Flag definition

- Name: `disableWebRTCRegistration`
- Type: `boolean`
- Default: `false` when omitted
- Scope: Contact Center plugin configuration (`cc` config object)

### Effective rule

WebRTC/Mobius registration must happen only when:

- browser station login path applies (`loginOption === LoginOption.BROWSER` where relevant), and
- `disableWebRTCRegistration !== true`

## Functional Behavior Changes

### 1) Registration-time Mobius connect gate

In `register()` inside `packages/@webex/contact-center/src/cc.ts`, current behavior attempts `this.$webex.internal.mercury.connect()` when:

- `agentConfig.webRtcEnabled` is true, and
- `agentConfig.loginVoiceOptions` includes `LoginOption.BROWSER`

Enhancement:

- Add config gate so `mercury.connect()` is skipped when `disableWebRTCRegistration === true`.

Effective condition:

- `agentConfig.webRtcEnabled`
- `agentConfig.loginVoiceOptions.includes(LoginOption.BROWSER)`
- `this.$config?.disableWebRTCRegistration !== true`

### 2) Station login browser calling line registration gate

In `stationLogin(data)` in `cc.ts`, current behavior registers calling line when:

- `agentConfig.webRtcEnabled` is true, and
- `data.loginOption === LoginOption.BROWSER`

Enhancement:

- Add config gate so `this.webCallingService.registerWebCallingLine()` is skipped when `disableWebRTCRegistration === true`.

Effective condition:

- `agentConfig.webRtcEnabled`
- `data.loginOption === LoginOption.BROWSER`
- `this.$config?.disableWebRTCRegistration !== true`

### 3) Device-type handling gate for browser flows

In `handleDeviceType(deviceType, dn)` in `cc.ts`, current behavior calls `registerWebCallingLine()` for `LoginOption.BROWSER`.

Enhancement:

- Add config gate so browser device type does **not** register WebRTC line when `disableWebRTCRegistration === true`.
- This ensures consistency for all browser device-type transitions (including update/relogin paths that route through `handleDeviceType`).

Effective condition for BROWSER case:

- `deviceType === LoginOption.BROWSER`
- `this.$config?.disableWebRTCRegistration !== true`

If config is true, skip registration and continue method flow without throwing.

## Default/Backward Compatibility

- When `disableWebRTCRegistration` is omitted or `false`, behavior remains unchanged.
- Existing browser login and WebRTC registration paths continue to function exactly as today.
- No change to non-browser login options (`AGENT_DN`, `EXTENSION`) behavior.

## Sample App Changes

Files:

- `docs/samples/contact-center/index.html`
- `docs/samples/contact-center/app.js`

### UI change in sample (`index.html`)

Add a new unchecked toggle (checkbox) in the authentication/config area:

- Label: `Disable WebRTC Registration`
- Element id (proposed): `disable-webrtc-registration`
- Default: unchecked (preserves current behavior)

### Config wiring in sample (`app.js`)

#### Read toggle state

- Query the new checkbox element and read `checked` value at init time.

#### Pass flag to SDK init

Both init paths in the sample should pass the flag:

- token-based init (`initWebex`)
- OAuth init (`initOauth`)

Required init shape:

`Webex.init({ config: { ...webexConfig, cc: { disableWebRTCRegistration: <checkboxState> }}, ... })`

Notes:

- Preserve existing `webexConfig` generation and env-dependent service overrides.
- Ensure `cc` config merge does not clobber other `config` fields.
- Boolean value should map directly from checkbox state.

## Proposed Implementation Details (SDK)

### Types/config

Update Contact Center plugin config typing to include:

- `disableWebRTCRegistration?: boolean`

This should be part of the existing config type consumed by `this.$config` in `cc.ts`.

### Helper (recommended)

To avoid repeating inline checks, add a private helper in `cc.ts`:

- `private isWebRTCRegistrationDisabled(): boolean`
- Returns `this.$config?.disableWebRTCRegistration === true`

Use this helper in all three touchpoints (`register`, `stationLogin`, `handleDeviceType`).

### Logging (recommended)

Add informational logs when registration is intentionally skipped due to config, e.g.:

- "Skipping Mobius/WebRTC registration because disableWebRTCRegistration is enabled"

This helps debugging without treating it as an error condition.

## Behavior Matrix

| webRtcEnabled | Login option / capability context | disableWebRTCRegistration | Expected behavior |
| --- | --- | --- | --- |
| false | any | false/true/unset | No Mobius/WebRTC line registration |
| true | non-BROWSER login path | false/true/unset | No browser calling line registration |
| true | BROWSER-capable/path | unset | Register Mobius/WebRTC (existing behavior) |
| true | BROWSER-capable/path | false | Register Mobius/WebRTC (existing behavior) |
| true | BROWSER-capable/path | true | Skip Mobius/WebRTC registration |

## Acceptance Criteria

1. `disableWebRTCRegistration` is read from `Webex.init({ config: { cc: ... }})`.
2. If flag is `true`, SDK does not:
   - call `webex.internal.mercury.connect()` in registration path for browser WebRTC capability.
   - call `registerWebCallingLine()` during browser `stationLogin`.
   - call `registerWebCallingLine()` for browser branch in `handleDeviceType`.
3. If flag is `false` or omitted, current behavior is unchanged.
4. Sample app includes a new unchecked toggle and passes the value into `Webex.init` as `config.cc.disableWebRTCRegistration` in both auth flows.
5. No regressions for non-browser station login types.

## Test Plan

### SDK behavior validation

1. **Default path (flag omitted)**  
   - Initialize SDK without `config.cc.disableWebRTCRegistration`.  
   - Perform browser station login.  
   - Verify Mobius/WebRTC registration path executes (current behavior).

2. **Explicit false**  
   - Initialize with `disableWebRTCRegistration: false`.  
   - Perform browser station login.  
   - Verify Mobius/WebRTC registration still executes.

3. **Explicit true**  
   - Initialize with `disableWebRTCRegistration: true`.  
   - Perform browser station login.  
   - Verify no Mobius connect / no calling line registration; station login still succeeds for non-calling concerns.

4. **Non-browser login**  
   - Use `AGENT_DN` or `EXTENSION` login with flag true/false.  
   - Verify existing non-browser behavior unchanged.

5. **Profile/device type update path**  
   - Trigger flow that reaches `handleDeviceType(LoginOption.BROWSER, ...)`.  
   - With flag true, verify no calling line registration attempt.

### Sample app validation

1. Toggle unchecked (default), init via token and OAuth; verify existing behavior.
2. Toggle checked, init via token and OAuth; verify `Webex.init` receives `config.cc.disableWebRTCRegistration: true`.
3. Confirm setting toggles behavior without other init regressions.

## Out of Scope

- Changing server-side station-login semantics.
- Altering WebRTC capability (`webRtcEnabled`) determination logic.
- Adding new APIs/events beyond config-driven registration gating.
