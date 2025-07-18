# @webex/plugin-authorization-browser

> OAuth2 authorization plugin for browser environments in the Cisco Webex JS SDK. Handles OAuth2 flows including Implicit Grant and Authorization Code Grant for web applications.

## Table of Contents

- [@webex/plugin-authorization-browser](#webexplugin-authorization-browser)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [What it Does](#what-it-does)
  - [Usage](#usage)
    - [Basic OAuth2 Login](#basic-oauth2-login)
    - [Implicit Grant Flow](#implicit-grant-flow)
    - [Authorization Code Grant Flow](#authorization-code-grant-flow)
    - [Login with Popup Window](#login-with-popup-window)
    - [JWT Authentication](#jwt-authentication)
    - [Guest JWT Creation](#guest-jwt-creation)
    - [Logout](#logout)
    - [Checking Authentication Status](#checking-authentication-status)
    - [Error Handling](#error-handling)
  - [API Reference](#api-reference)
    - [Methods](#methods)
      - [`initiateLogin(options)`](#initiateloginoptions)
      - [`initiateImplicitGrant(options)`](#initiateimplicitgrantoptions)
      - [`initiateAuthorizationCodeGrant(options)`](#initiateauthorizationcodegrantoptions)
      - [`requestAccessTokenFromJwt({ jwt })`](#requestaccesstokenfromjwt-jwt-)
      - [`createJwt(options)`](#createjwtoptions)
      - [`logout(options)`](#logoutoptions)
    - [Properties](#properties)
      - [`isAuthorizing` (boolean)](#isauthorizing-boolean)
      - [`isAuthenticating` (boolean)](#isauthenticating-boolean)
      - [`ready` (boolean)](#ready-boolean)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

```bash
npm install --save @webex/plugin-authorization-browser
```

## What it Does

The `@webex/plugin-authorization-browser` plugin provides OAuth2 authentication capabilities specifically for browser environments. It:

- **Automatically handles OAuth2 flows**: Supports both Implicit Grant and Authorization Code Grant flows
- **Manages authentication state**: Tracks authorization status and handles token parsing from URL
- **Provides CSRF protection**: Generates and validates CSRF tokens for security
- **Supports popup authentication**: Can open login in a separate window
- **JWT token support**: Create and use JWT tokens for guest authentication
- **URL cleanup**: Automatically removes sensitive tokens from browser URL after authentication
- **Cross-browser compatibility**: Works across different browser environments

## Usage

### Basic OAuth2 Login

The simplest way to authenticate users:

```javascript
const Webex = require('webex');

// Initialize Webex SDK
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    redirect_uri: 'https://your-app.com/callback',
    scope: 'spark:all'
  }
});

// Start the login process
webex.authorization.initiateLogin()
  .then(() => {
    console.log('Login initiated');
    // User will be redirected to Webex login page
  });

// After redirect, check if user is authenticated
if (webex.canAuthorize) {
  console.log('User is authenticated');
  // Make API calls
}
```

### Implicit Grant Flow

For public clients (single-page applications):

```javascript
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    redirect_uri: 'https://your-app.com/callback',
    scope: 'spark:all'
    // No client_secret for public clients
  }
});

// Initiate implicit grant flow
webex.authorization.initiateImplicitGrant({
  state: { customData: 'value' } // Optional state data
})
.then(() => {
  console.log('Implicit grant flow started');
});
```

### Authorization Code Grant Flow  

For confidential clients with client secret:

```javascript
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    redirect_uri: 'https://your-app.com/callback',
    scope: 'spark:all',
    clientType: 'confidential' // This triggers authorization code flow
  }
});

// Initiate authorization code grant flow
webex.authorization.initiateAuthorizationCodeGrant({
  state: { customData: 'value' }
})
.then(() => {
  console.log('Authorization code flow started');
});
```

### Login with Popup Window

Open login in a separate popup window instead of redirecting:

```javascript
// Basic popup with default dimensions (600x800)
webex.authorization.initiateLogin({
  separateWindow: true
});

// Custom popup dimensions
webex.authorization.initiateLogin({
  separateWindow: {
    width: 800,
    height: 600
  }
});

// With custom state and popup
webex.authorization.initiateLogin({
  state: { 
    returnUrl: '/dashboard',
    userId: 'user123'
  },
  separateWindow: {
    width: 900,
    height: 700
  }
});
```

### JWT Authentication

Authenticate using a JWT token (useful for guest users):

```javascript
// Assuming you have a JWT from your backend
const jwtToken = '<YOUR_JWT_TOKEN_HERE>';

webex.authorization.requestAccessTokenFromJwt({
  jwt: jwtToken
})
.then(() => {
  console.log('Authenticated with JWT');
  // User is now authenticated and can make API calls
})
.catch(error => {
  console.error('JWT authentication failed:', error);
});
```

### Guest JWT Creation

Create JWT tokens for guest users:

```javascript
// Create a guest JWT token
webex.authorization.createJwt({
  issuer: 'your-guest-issuer-id',
  secretId: 'your-base64-encoded-secret',
  displayName: 'Guest User Name', // Optional
  expiresIn: '12h' // Token expiration
})
.then(({ jwt }) => {
  console.log('Created guest JWT:', jwt);
  
  // Use the JWT to authenticate
  return webex.authorization.requestAccessTokenFromJwt({ jwt });
})
.then(() => {
  console.log('Guest user authenticated');
})
.catch(error => {
  console.error('Guest JWT creation failed:', error);
});
```

### Logout

Log out the current user:

```javascript
// Logout and redirect to Webex logout page
webex.authorization.logout();

// Logout without redirect (clean up local session only)  
webex.authorization.logout({ noRedirect: true });

// Logout with custom logout URL
webex.authorization.logout({ 
  goto: 'https://your-app.com/goodbye' 
});
```

### Checking Authentication Status

```javascript
// Check if SDK can authorize (has valid token)
if (webex.canAuthorize) {
  console.log('User is authenticated');
}

// Check if authorization is in progress
if (webex.authorization.isAuthorizing) {
  console.log('Authorization in progress...');
}

// Listen for authentication events
webex.on('ready', () => {
  console.log('SDK is ready and authenticated');
});

webex.on('unauthorized', () => {
  console.log('User is not authenticated');
});
```

### Error Handling

```javascript
// Handle authentication errors from URL
try {
  const webex = Webex.init({
    credentials: { /* your config */ }
  });
} catch (error) {
  if (error.name === 'OAuthError') {
    console.error('OAuth error:', error.message);
    // Handle specific OAuth errors like access_denied
  }
}

// Handle JWT authentication errors
webex.authorization.requestAccessTokenFromJwt({ jwt: 'invalid-jwt' })
.catch(error => {
  console.error('JWT authentication failed:', error);
});
```

## API Reference

### Methods

#### `initiateLogin(options)`

Initiates the appropriate OAuth flow based on client configuration.

- `options.state` - Optional state object for custom data
- `options.separateWindow` - Boolean or object for popup window settings

#### `initiateImplicitGrant(options)`

Starts the Implicit Grant flow for public clients.

#### `initiateAuthorizationCodeGrant(options)`

Starts the Authorization Code Grant flow for confidential clients.

#### `requestAccessTokenFromJwt({ jwt })`

Exchanges a JWT for an access token.

#### `createJwt(options)`

Creates a JWT token for guest authentication.

- `options.issuer` - Guest issuer ID
- `options.secretId` - Base64 encoded secret
- `options.displayName` - Optional display name
- `options.expiresIn` - Token expiration time

#### `logout(options)`

Logs out the current user.

- `options.noRedirect` - Skip redirect to logout page
- `options.goto` - Custom redirect URL after logout

### Properties

#### `isAuthorizing` (boolean)

Indicates if an authorization flow is currently in progress.

#### `isAuthenticating` (boolean)  

Alias for `isAuthorizing`.

#### `ready` (boolean)

Indicates if the authorization plugin has finished initialization.

---

## Maintainers

This package is maintained by Cisco Webex for Developers.

## Contribute

Pull requests welcome. Please see CONTRIBUTING.md for more details.

## License

This project is licensed under the Cisco General Terms - see the LICENSE for details.

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
