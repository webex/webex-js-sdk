# Calling SDK Lab

This lab mirrors the Contact Center lab structure and demonstrates Webex Calling WebRTC SDK basics:

- Initialize Calling with a Personal Access Token
- Register and obtain a `line`
- Acquire microphone and wire media
- Make and answer calls
- Control calls (mute/hold/end)
- Send DTMF digits using a dial pad

## Files

```
docs/labs/calling/
├── index.html          # Lab UI
├── index.js            # Orchestration
├── styles.css          # Styles
└── modules/
    ├── auth.js         # Initialization
    ├── registration.js # Register/deregister/line helpers
    └── call-controls.js# Call control helpers (placeholder)
```

## Notes

- DTMF: Use `call.sendDigit('123#')` or per-key press from the dial pad. This calls through to the SDK which inserts DTMF on the media connection.
- The lab expects the calling UMD from `docs/samples/calling.min.js` already built by the repo.

## DTMF Dialer and IVR Use Case

Interactive Voice Response (IVR) systems commonly prompt callers to navigate menus (e.g., "Press 1 for Sales") or enter information (e.g., account numbers). During an established call, you can send DTMF tones either one-by-one or as a sequence:

```javascript
// Single selection (e.g., Press 1 for Sales)
call.sendDigit('1');

// Enter an account number followed by #
const accountNumber = '123456';
call.sendDigit(accountNumber + '#');

// If using the lab's dialpad: per-key presses call sendDigit(key)
// automatically; the Send button submits the current input field.
```

Tips:
- Only call `sendDigit` once the call is established and you can hear the IVR prompts.
- The dialpad in this lab sends each key immediately, but also lets you batch send when needed.

## OAuth (Implicit) Flow — Calling

For production, use OAuth instead of a PAT. Create an Integration at the Webex Developer Portal and configure:

- Client ID (public)
- Redirect URI (e.g., `http://localhost:<PORT>/` while testing)
- Scopes (minimum for Calling):
  - `spark:webrtc_calling`
  - `spark:calls_read`
  - `spark:calls_write`
  - `spark:kms`
  - `spark:xsi`

Example (also shown in `index.html`):

```javascript
const webex = Webex.init({
  config: {
    credentials: {
      client_id: 'YOUR_PUBLIC_CLIENT_ID',
      redirect_uri: window.location.origin + window.location.pathname,
      scope: [
        'spark:webrtc_calling',
        'spark:calls_read',
        'spark:calls_write',
        'spark:kms',
        'spark:xsi'
      ].join(' ')
    }
  }
});

await webex.authorization.initiateLogin();

// After redirect back, the access_token is in the URL hash. The lab auto-detects
// it and initializes Calling using that token.
```



