# @webex/plugin-authorization-browser-first-party

> First-party (Webex Web Client) browser authorization plugin. Implements hardened OAuth 2.0 Authorization Code + PKCE handling, CSRF protection, URL sanitization, and Device Authorization (QR Code) support used by the official Webex web experience.  
> NOT intended for general third‑party application use – prefer `@webex/plugin-authorization-browser` or `@webex/plugin-authorization` (auto environment selection) unless you explicitly maintain the Webex first-party client.

## Table of Contents

- [@webex/plugin-authorization-browser-first-party](#webexplugin-authorization-browser-first-party)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [What It Does](#what-it-does)
  - [When To Use This Package](#when-to-use-this-package)
  - [Key Features](#key-features)
  - [Basic Usage](#basic-usage)
    - [Standard Login (Authorization Code + PKCE)](#standard-login-authorization-code--pkce)
    - [Popup / Separate Window Login](#popup--separate-window-login)
    - [Device Authorization (QR Code Login)](#device-authorization-qr-code-login)
  - [Events](#events)
  - [API Reference](#api-reference)
    - [Methods](#methods)
    - [Properties](#properties)
  - [Security Considerations](#security-considerations)
  - [Error Handling](#error-handling)
  - [Related Packages](#related-packages)
  - [Contribute](#contribute)
  - [Maintainers](#maintainers)
  - [License](#license)

## Install

```bash
npm install --save @webex/plugin-authorization-browser-first-party
```

## What It Does

This plugin provides a specialized browser-only implementation of OAuth 2.0 flows tailored for the Webex first-party web application. It:

- Detects redirects containing an authorization `code`
- Validates and removes transient sensitive parameters (`code`, CSRF token) from the URL
- Implements PKCE (S256) generation + verification
- Exchanges the authorization code for an access + refresh (supertoken) bundle
- Optionally pre-collects a *preauth service catalog* using hints (email hash / orgId)
- Supports device (QR Code) authorization polling for login via secondary devices

## When To Use This Package

Use this package **only** if you are:

- Working directly on the Webex first-party browser client
- Needing feature parity with internal flows (preauth catalog, QR device login)
- Debugging or extending internal auth behavior in the mono-repo

Otherwise choose:

| Use Case                   | Recommended Package                   |
| -------------------------- | ------------------------------------- |
| Generic browser SPA        | `@webex/plugin-authorization-browser` |
| Auto environment selection | `@webex/plugin-authorization`         |
| Node.js / server-side      | `@webex/plugin-authorization-node`    |

## Key Features

| Feature                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| Authorization Code + PKCE | Secure code flow with SHA256 (S256) code challenge                   |
| CSRF Protection           | Random state-bound CSRF token validated on return                    |
| URL Sanitization          | Removes `code` & CSRF artifacts post-redirect to reduce leakage risk |
| Preauth Catalog Hinting   | Uses `emailhash` or extracted `orgId` to prefetch service catalog    |
| Device Authorization (QR) | Implements OAuth Device Code grant with polling + slow-down handling |
| Popup Support             | Optional separate window login (configurable dimensions)             |
| Event Emitter             | Emits granular events for QR/device flow progress                    |
| Supertoken Storage        | Consolidated access + refresh token assignment to credentials plugin |

## Basic Usage

> NOTE: This plugin is *internal*; examples below assume you intentionally select this package.

```javascript
const Webex = require('webex');

const webex = Webex.init({
  credentials: {
    client_id: 'first-party-client-id',
    client_secret: 'first-party-client-secret',
    redirect_uri: 'https://web.webex.com/auth/callback',
    scope: 'spark:all'
  }
});

// Initiate login (generates PKCE + CSRF + email hash if provided)
webex.authorization.initiateLogin({
  email: 'user@example.com',          // optional; hashed internally
  state: { returnTo: '/home' },        // additional app state
  separateWindow: { width: 600, height: 800 } // popup mode (optional)
});
```

### Standard Login (Authorization Code + PKCE)

1. `initiateLogin()` creates:
   - CSRF token
   - PKCE code_verifier + code_challenge
   - Encoded state (base64) containing security + optional fields
2. Browser navigates to IdBroker
3. Redirect returns with `?code=...&state=...`
4. Plugin `initialize()`:
   - Validates CSRF
   - Cleans URL
   - Exchanges code (`requestAuthorizationCodeGrant`)
   - Stores tokens on `webex.credentials`

### Popup / Separate Window Login

```javascript
webex.authorization.initiateLogin({
  separateWindow: true // or object with window features
});
```

### Device Authorization (QR Code Login)

```javascript
// Subscribe to QR code events
webex.authorization.eventEmitter.on(
  webex.authorization.Events.qRCodeLogin,
  ({eventType, userData, data}) => {
    switch (eventType) {
      case 'getUserCodeSuccess':
        // Display userData.userCode & create QR pointing to userData.verificationUriComplete
        break;
      case 'authorizationPending':
        // Still waiting for user to complete action
        break;
      case 'authorizationSuccess':
        // Tokens available in data (supertoken already set)
        break;
      case 'authorizationFailure':
      case 'getUserCodeFailure':
        // Handle error
        break;
      case 'pollingCanceled':
        // User canceled or timed out
        break;
    }
  }
);

// Begin device (QR) login
webex.authorization.initQRCodeLogin();

// Optional cancel
// webex.authorization.cancelQRCodePolling();
```

## Events

| Event `eventType`      | Emitted When                                | Payload Fields                                                                      |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `getUserCodeSuccess`   | Device code created                         | `userData.userCode`, `userData.verificationUri`, `userData.verificationUriComplete` |
| `getUserCodeFailure`   | User code request failed                    | `data` (error body/message)                                                         |
| `authorizationPending` | Polling continues (428)                     | `data` (server body)                                                                |
| `authorizationSuccess` | Device code exchanged                       | `data` (token response)                                                             |
| `authorizationFailure` | Terminal polling error or timeout           | `data` (error body/message)                                                         |
| `pollingCanceled`      | Explicit cancel or internal timeout cleanup | none                                                                                |

## API Reference

### Methods

| Method                                                  | Description                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `initiateLogin(options)`                                | Starts PKCE + CSRF protected Authorization Code flow (popup or redirect) |
| `initiateAuthorizationCodeGrant(options)`               | Low-level redirect builder (normally called via `initiateLogin`)         |
| `requestAuthorizationCodeGrant({ code, codeVerifier })` | Exchanges authorization code for token bundle                            |
| `initQRCodeLogin()`                                     | Initiates device authorization (QR) flow                                 |
| `cancelQRCodePolling(withCancelEvent=true)`             | Cancels active device authorization polling loop                         |

### Properties

| Property           | Type             | Description                                               |
| ------------------ | ---------------- | --------------------------------------------------------- |
| `isAuthorizing`    | boolean          | True while a grant request is in flight                   |
| `isAuthenticating` | boolean          | Alias of `isAuthorizing`                                  |
| `ready`            | boolean          | Set true after initial redirect/code processing completes |
| `eventEmitter`     | EventEmitter     | Emits QR/Device login lifecycle events                    |
| `Events`           | enum-like object | Accessible names for event types                          |

## Security Considerations

| Control             | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| CSRF Token in State | Prevents forged redirect responses                                 |
| PKCE (S256)         | Mitigates interception of authorization code                       |
| URL Cleanup         | Prevents accidental sharing of `code` via history/referrers        |
| Single-use Storage  | `code_verifier` & CSRF token removed immediately after use         |
| Email Hashing       | Uses SHA256(email) to reduce raw PII propagation for preauth hints |

## Error Handling

- OAuth errors returned during redirect raise mapped `grantErrors`
- Device flow handles `slow_down` (400) by exponential interval adjustment
- Status `428` considered pending (continues polling)
- Terminal errors emit `authorizationFailure`

Example:

```javascript
webex.authorization.requestAuthorizationCodeGrant({ code })
  .catch(err => {
    if (err.name === 'InvalidGrantError') {
      // Handle invalid/expired code
    } else {
      console.error('Authorization failure', err);
    }
  });
```

## Related Packages

| Package                               | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `@webex/plugin-authorization`         | Auto-selects env-specific implementation   |
| `@webex/plugin-authorization-browser` | Public browser auth (implicit + code)      |
| `@webex/plugin-authorization-node`    | Node/server-side flows                     |
| `webex`                               | Unified SDK bundle including authorization |

Also see:

- [Browser OAuth Flow Guide](../plugin-authorization-browser/BROWSER-OAUTH-FLOW-GUIDE.md)
- [Node OAuth Flow Guide](../plugin-authorization-node/NODE-OAUTH-FLOW-GUIDE.md)

## Contribute

Internal changes should follow repository contribution guidelines. External users generally should *not* rely on this package. See [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md).

## Maintainers

This package is maintained by Cisco Webex for Developers.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
