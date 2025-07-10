# @webex/plugin-authorization-node

This package provides authentication functionality for Node.js applications using the Webex SDK.

## Install

```bash
npm install --save @webex/plugin-authorization-node
```

## Usage

This is a plugin for the Cisco Webex JS SDK. Please see our developer portal and the API docs for full details.

```js
const Webex = require('webex');

const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    client_secret: 'your-client-secret'
  }
});

// Exchange authorization code for access token
webex.authorization.requestAuthorizationCodeGrant({
  code: 'authorization-code'
}).then(() => {
  console.log('Authentication successful');
});

// Use JWT for authentication
webex.authorization.requestAccessTokenFromJwt({
  jwt: 'your-jwt-token'
}).then(() => {
  console.log('JWT authentication successful');
});

// Create JWT token
webex.authorization.createJwt({
  issuer: 'guest-issuer-id',
  secretId: 'base64-encoded-secret',
  displayName: 'Guest User',
  expiresIn: '12h'
}).then(({jwt}) => {
  console.log('JWT created:', jwt);
});
```

## Methods

### requestAuthorizationCodeGrant(options)

Exchanges an authorization code for an access token.

- `options.code` - The authorization code received from the provider

### requestAccessTokenFromJwt(options)

Requests access token using JWT.

- `options.jwt` - JWT token for authentication

### createJwt(options)

Creates a JWT token.

- `options.issuer` - Guest issuer ID
- `options.secretId` - Base64 encoded secret
- `options.displayName` - Display name (optional)
- `options.expiresIn` - Token expiration time

### logout(options)

Logs out the current user.

- `options.token` - Token to invalidate (optional)

## Properties

### isAuthorizing

Boolean indicating if authorization is in progress.

### isAuthenticating

Alias for isAuthorizing.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
