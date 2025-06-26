# @webex/plugin-authorization

This package automatically loads the appropriate environment-specific authorization plugin for the Webex SDK.

## Install

```bash
npm install --save @webex/plugin-authorization
```

## What it Does

The `@webex/plugin-authorization` package serves as a universal entry point that automatically selects and loads the correct authorization implementation based on your environment:

- **Browser environments**: Loads `@webex/plugin-authorization-browser` for client-side applications
- **Node.js environments**: Loads `@webex/plugin-authorization-node` for server-side applications

This allows you to use a single import while getting the optimal authorization implementation for your runtime environment.

## Usage

This is a plugin for the Cisco Webex JS SDK. Please see our developer portal and the API docs for full details.

```js
const Webex = require('webex');

const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    client_secret: 'your-client-secret', // Only for Node.js environments
    redirect_uri: 'https://your-app.com/callback' // Only for browser environments
  }
});

// The authorization methods available depend on your environment:

// In Node.js environments:
webex.authorization.requestAuthorizationCodeGrant({
  code: 'authorization-code'
});

webex.authorization.requestAccessTokenFromJwt({
  jwt: 'your-jwt-token'
});

// In browser environments:
webex.authorization.initiateLogin();
webex.authorization.initiateImplicitGrant();
```

## Environment Detection

The package uses the following logic to determine which implementation to load:

1. **Browser environments**: When running in a browser context, it loads the browser-specific plugin with support for redirects, popups, and client-side flows
2. **Node.js environments**: When running in Node.js, it loads the server-specific plugin with support for server-to-server authentication flows

## Client Types and OAuth Flows

The Webex SDK supports different OAuth flows based on the `clientType` you configure. This determines how your application authenticates with Webex:

### `clientType: 'confidential'` (Authorization Code Grant)

- **Flow:** Authorization Code Grant
- **How:** User is redirected to Webex login, receives an authorization code, and your backend exchanges it for tokens.
- **Requires:** Client secret (must be kept secure, so only for server-side or backend apps)
- **Use Case:** Web applications with a backend, integrations, bots, or any app that can securely store a client secret.
- **SDK Behavior:** Calls `initiateAuthorizationCodeGrant()` and uses `response_type=code`.

### `clientType: 'public'` (Implicit Grant)

- **Flow:** Implicit Grant
- **How:** User is redirected to Webex login, and receives an access token directly in the browser.
- **Requires:** No client secret (safe for browser-only apps)
- **Use Case:** Single-page applications (SPAs), mobile apps, or any app that cannot securely store a client secret.
- **SDK Behavior:** Calls `initiateImplicitGrant()` and uses `response_type=token`.

### `client_credentials` (Client Credentials Grant)

- **Flow:** Client Credentials Grant
- **How:** Application authenticates as itself (no user context), directly exchanges client ID and secret for a token.
- **Requires:** Client secret (must be kept secure, so only for server-side or backend apps)
- **Use Case:** Server-to-server integrations, bots, or background services.
- **SDK Behavior:** Only available in Node.js SDK via `getClientToken()`.

> **Note:** Only `'confidential'` and `'public'` are meaningful for browser SDK. `client_credentials` is only supported in Node.js/server SDKs.

---

## Available Methods

The methods available through this plugin depend on your runtime environment:

### Browser Environment Methods

- `initiateLogin(options)` - Start the login process. Automatically chooses the correct flow based on `clientType`:
  - If `clientType: 'confidential'`, uses Authorization Code Grant (`initiateAuthorizationCodeGrant`)
  - Otherwise, uses Implicit Grant (`initiateImplicitGrant`)
- `initiateImplicitGrant(options)` - Begin implicit grant flow (redirects with `response_type=token`)
- `initiateAuthorizationCodeGrant(options)` - Begin authorization code flow (redirects with `response_type=code`)
- `requestAccessTokenFromJwt({ jwt })` - Authenticate using JWT
- `createJwt(options)` - Create JWT tokens
- `logout(options)` - Log out the user

#### Difference between `initiateAuthorizationCodeGrant` and `initiateImplicitGrant`

| Method                           | OAuth Flow               | response_type | Token Delivery        | Requires Client Secret | Use Case                |
| -------------------------------- | ------------------------ | ------------- | --------------------- | ---------------------- | ----------------------- |
| `initiateAuthorizationCodeGrant` | Authorization Code Grant | `code`        | Code in URL, exchange | Yes                    | Backend web apps        |
| `initiateImplicitGrant`          | Implicit Grant           | `token`       | Token in URL hash     | No                     | SPAs, browser-only apps |

- **Authorization Code Grant**: More secure, requires backend to exchange code for tokens.
- **Implicit Grant**: Less secure, tokens delivered directly to browser.

See [Browser OAuth Flow Guide](../plugin-authorization-browser/BROWSER-OAUTH-FLOW-GUIDE.md) for more details.

### Node.js Environment Methods

- `requestAuthorizationCodeGrant(options)` - Exchange authorization code for token
- `requestAccessTokenFromJwt({ jwt })` - Authenticate using JWT
- `getClientToken(options)` - Obtain a client token using client_credentials grant
- `createJwt(options)` - Create JWT tokens
- `logout(options)` - Log out the user

### Common Properties

- `isAuthorizing` - Boolean indicating if authorization is in progress
- `isAuthenticating` - Alias for isAuthorizing

## Related Packages

- `@webex/plugin-authorization-browser` - Browser-specific implementation
- `@webex/plugin-authorization-node` - Node.js-specific implementation

For detailed documentation on environment-specific features, please refer to the individual package documentation.

See [Node OAuth Flow Guide](../plugin-authorization-node/NODE-OAUTH-FLOW-GUIDE.md) for Node.js-specific flows.

See [Browser OAuth Flow Guide](../plugin-authorization-browser/BROWSER-OAUTH-FLOW-GUIDE.md) for browser-specific flows.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
