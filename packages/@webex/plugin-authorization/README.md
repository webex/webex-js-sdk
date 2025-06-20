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

## Available Methods

The methods available through this plugin depend on your runtime environment:

### Browser Environment Methods

- `initiateLogin(options)` - Start the login process
- `initiateImplicitGrant(options)` - Begin implicit grant flow
- `initiateAuthorizationCodeGrant(options)` - Begin authorization code flow
- `requestAccessTokenFromJwt({ jwt })` - Authenticate using JWT
- `createJwt(options)` - Create JWT tokens
- `logout(options)` - Log out the user

### Node.js Environment Methods

- `requestAuthorizationCodeGrant(options)` - Exchange authorization code for token
- `requestAccessTokenFromJwt({ jwt })` - Authenticate using JWT
- `createJwt(options)` - Create JWT tokens
- `logout(options)` - Log out the user

### Common Properties

- `isAuthorizing` - Boolean indicating if authorization is in progress
- `isAuthenticating` - Alias for isAuthorizing

## Related Packages

- `@webex/plugin-authorization-browser` - Browser-specific implementation
- `@webex/plugin-authorization-node` - Node.js-specific implementation

For detailed documentation on environment-specific features, please refer to the individual package documentation.
