# Webex Browser OAuth Authorization Flow - Technical Guide

This document explains how the Webex SDK handles OAuth authorization in browser environments, covering the complete flow from initialization to token management.

## Table of Contents

- [Browser Webex Initialization](#1-browser-webex-initialization)
- [Browser OAuth Flow Trigger](#2-browser-oauth-flow-trigger)
- [Authorization Code Processing](#3-authorization-code-processing)
- [Token Generation and Exchange](#4-token-generation-and-exchange)
- [Refresh Token Management](#5-refresh-token-management)
- [Browser Ready and Authorization Events](#6-browser-ready-and-authorization-events)

---

## 1. Browser Webex Initialization

### 1.1 Basic Browser Setup

Browser applications initialize the Webex SDK with OAuth parameters:

```javascript
// Basic browser initialization
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    redirect_uri: 'https://your-app.com/callback',
    scope: 'spark:all spark:kms',
    clientType: 'public' // or 'confidential'
  }
});
```

Parameters:

- **client_id**: Your registered application ID
- **redirect_uri**: Where to send the user after authentication
- **scope**: Requested permissions (e.g., 'spark:all spark:kms')
- **clientType**: 'public' (default) or 'confidential'

**Reference**: See `docs/samples/browser-auth/app.js` for a working example

### 1.2 Browser Flow Type Determination

The browser plugin automatically selects OAuth flow based on `clientType`:

```javascript
// Public client (default) - uses response_type=token
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    clientType: 'public' // or omit (defaults to public)
  }
});
// Calls initiateImplicitGrant() -> response_type=token

// Confidential client - uses response_type=code  
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    clientType: 'confidential'
  }
});
// Calls initiateAuthorizationCodeGrant() -> response_type=code
```

Flow selection:

- **Public Client** (`clientType: 'public'` or undefined): Uses **Implicit Grant** with `response_type=token`
- **Confidential Client** (`clientType: 'confidential'`): Uses **Authorization Code Grant** with `response_type=code`

**Reference**: `initiateLogin()` method in `packages/@webex/plugin-authorization-browser/src/authorization.js`

### 1.3 Webex ID Broker Grant Types and Browser SDK Implementation

Webex ID Broker supports several OAuth 2.0 grant types. The browser SDK implements them as follows:

#### 1. Authorization Code Grant (`clientType: 'confidential'`)

**Webex ID Broker**: Returns authorization code after user authentication  
**Browser SDK**: Uses `response_type=code`, then exchanges code for tokens

```javascript
// SDK automatically handles this flow
const webex = Webex.init({
  credentials: { clientType: 'confidential', /* other config */ }
});
webex.authorization.initiateLogin(); // Uses response_type=code
```

#### 2. Implicit Grant (`clientType: 'public'` - default)

**Webex ID Broker**: Returns access token directly after user authentication  
**Browser SDK**: Uses `response_type=token`, receives token in URL hash

```javascript
// SDK automatically handles this flow
const webex = Webex.init({
  credentials: { clientType: 'public', /* other config */ }
});
webex.authorization.initiateLogin(); // Uses response_type=token
```

#### 3. Refresh Token Grant (automatic)

**Webex ID Broker**: Exchanges refresh token for new access token  
**Browser SDK**: Automatically uses `grant_type=refresh_token` when tokens expire

```javascript
// SDK handles refresh automatically, or manually:
webex.credentials.supertoken.refresh(); // Uses grant_type=refresh_token
```

#### 4. Client Credentials Grant (Node.js only)

**Webex ID Broker**: Application-to-application authentication  
**Browser SDK**: Not supported (requires client secret)

**Note**: Client credentials grant is only available in Node.js SDK since it requires a client secret that cannot be safely stored in browsers.

### 1.4 Browser Implementation Differences

#### Implicit Grant Flow (Public Clients)

- **Security**: Tokens exposed in browser URL (less secure)
- **Client Secret**: No client secret required
- **Token Location**: Access token in URL hash fragment
- **Redirect**: Single redirect with token
- **Best For**: Single-page applications, mobile apps

#### Authorization Code Grant Flow (Confidential Clients)

- **Security**: More secure, tokens never exposed to browser
- **Client Secret**: Requires client secret
- **Token Location**: Authorization code in URL, exchanged server-side
- **Redirect**: Two-step process (code → token exchange)
- **Best For**: Web applications with backend

### 1.5 Browser URL Parsing on Load

During browser initialization, the plugin automatically:

1. **Parses current URL** for OAuth tokens/codes
2. **Checks for OAuth errors** in URL parameters
3. **Validates CSRF tokens** for security
4. **Cleans the URL** by removing sensitive parameters

**Reference**: `initialize()` method in `packages/@webex/plugin-authorization-browser/src/authorization.js`

---

## 2. Browser OAuth Flow Trigger

### 2.1 Initiating Browser Login

The `initiateLogin()` method redirects users to Webex's identity broker for authentication. It does **NOT** accept email/password directly.

```javascript
// Basic login - redirects to Webex login page
webex.authorization.initiateLogin()

// Login with custom state data
webex.authorization.initiateLogin({
  state: { 
    returnUrl: '/dashboard',
    userId: 'user123'
  }
})

// Login in popup window (default dimensions: 600x800)
webex.authorization.initiateLogin({
  separateWindow: true
})

// Login in popup with custom dimensions
webex.authorization.initiateLogin({
  separateWindow: {
    width: 800,
    height: 600
  }
})
```

Parameters:

- **options.state** (Object, optional): Custom data included in OAuth state
- **options.separateWindow** (Boolean|Object, optional): Open in popup window

Process:

1. **Generates CSRF token** for security
2. **Determines flow type** based on client configuration
3. **Builds OAuth URL** with required parameters
4. **Redirects user** to Webex identity broker

**Reference**: `initiateLogin()` method in browser authorization plugin

### 2.2 Browser CSRF Token Generation

Browser-specific CSRF protection:

1. **Generates UUID token** using `uuid.v4()`
2. **Stores in sessionStorage** for later verification
3. **Includes in state parameter** of OAuth request

**Reference**: `_generateSecurityToken()` method in browser plugin

### 2.3 Browser Redirection Options

Browser supports multiple redirection methods:

- **Same window**: Default behavior (full page redirect)
- **Popup window**: Optional separate window with configurable dimensions

**Reference**: `initiateImplicitGrant()` and `initiateAuthorizationCodeGrant()` methods

---

## 3. Authorization Code Processing

### 3.1 User Authentication at ID Broker

User experience at Webex identity broker:

1. **User enters credentials** (username/password, SSO, etc.)
2. **Identity verification** occurs
3. **Consent screen** may appear for scope approval
4. **Authorization decision** is made

### 3.2 Browser Redirect Back

After successful authentication:

- **Implicit Grant**: User redirected with access token in URL hash
- **Authorization Code Grant**: User redirected with authorization code in query parameters

### 3.3 Browser Code/Token Reception

Browser SDK processes the return URL automatically:

1. **URL parsing** during plugin initialization
2. **Error checking** for OAuth errors
3. **Token/code extraction** from URL parameters
4. **State validation** for CSRF protection

**Reference**: `initialize()` and `_parseHash()` methods in browser plugin

### 3.4 Browser CSRF Token Verification

Browser security validation:

1. **Extract state parameter** from redirect URL
2. **Decode Base64 state** object
3. **Compare CSRF tokens** (URL vs sessionStorage)
4. **Throw error** if tokens don't match

**Reference**: `_verifySecurityToken()` method in browser plugin

---

## 4. Token Generation and Exchange

### 4.1 Browser Implicit Grant Processing

For browser implicit grant, access token comes directly in URL hash:

- access_token
- token_type (Bearer)
- expires_in
- scope

> **Note:** Refresh tokens are generally not provided in implicit grant flows due to security reasons. Most OAuth providers, including Webex, do not issue refresh tokens for implicit grant to prevent long-lived tokens from being exposed in browser environments. Applications using implicit grant should expect to obtain new access tokens by re-authenticating the user when the current token expires.

**Reference**: Token parsing in `_parseHash()` method

### 4.2 Browser Authorization Code Exchange

For browser confidential clients, code exchange happens:

- **Client-side**: Code captured from URL
- **Server-side**: Code exchanged for tokens using client secret

### 4.3 Browser JWT Authentication

Browser JWT authentication for guest users:

```javascript
// Create JWT token
webex.authorization.createJwt({
  issuer: 'your-guest-issuer-id',
  secretId: 'your-base64-encoded-secret',
  displayName: 'Guest User Name',
  expiresIn: '12h'
}).then(({jwt}) => {
  console.log('Created JWT:', jwt);
  
  // Exchange JWT for access token
  return webex.authorization.requestAccessTokenFromJwt({jwt});
}).then(() => {
  console.log('Guest user authenticated');
}).catch(error => {
  console.error('JWT authentication failed:', error);
});
```

Process:

1. **Create JWT token** with issuer, secret, display name
2. **Exchange JWT for access token** via API call

**Reference**: `createJwt()` and `requestAccessTokenFromJwt()` methods in browser plugin

### 4.4 Browser Token Storage

Browser token storage:

1. **Stored in credentials object** via `webex.credentials.set()`
2. **Persisted in browser storage** (localStorage/sessionStorage)
3. **Monitored for expiration** by interceptors

---

## 5. Refresh Token Management

### 5.1 Browser Token Expiration Detection

Browser monitors token validity through:

```javascript
// Check if token is expired
if (webex.credentials.supertoken.isExpired) {
  console.log('Token is expired');
  // SDK will automatically refresh if refresh token available
}

// Check if token can be refreshed
if (webex.credentials.supertoken.canRefresh) {
  console.log('Token can be refreshed');
} else {
  console.log('User needs to re-authenticate');
  webex.authorization.initiateLogin();
}

// Manual token refresh
webex.credentials.supertoken.refresh().then((newToken) => {
  console.log('Token refreshed successfully');
}).catch((error) => {
  console.error('Token refresh failed:', error);
  webex.authorization.initiateLogin();
});
```

Detection mechanisms:

- **HTTP interceptors** checking responses
- **Automatic refresh triggers** before expiration
- **Error handling** for 401 Unauthorized responses

### 5.2 Browser Refresh Token Flow

Browser refresh token process using `refreshCallback`:

```javascript
// Configure refresh callback during initialization
const webex = Webex.init({
  credentials: {
    client_id: 'your-client-id',
    redirect_uri: 'https://your-app.com/callback',
    scope: 'spark:all spark:kms',
    refreshCallback: (webex, token) => {
      // Custom refresh logic for browser
      return webex.request({
        method: 'POST',
        uri: 'https://webexapis.com/v1/access_token',
        form: {
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
          client_id: token.config.client_id
        }
      }).then(response => response.body);
    }
  }
});
```

Refresh process:

1. **POST request** to `/access_token` endpoint
2. **grant_type**: "refresh_token"
3. **Current refresh token** as parameter
4. **Client ID** for identification
5. **New tokens returned** and stored automatically

### 5.3 Browser Automatic Refresh

SDK automatically handles token refresh:

```javascript
// SDK automatically refreshes tokens before API calls
webex.people.get('me').then(person => {
  // Token was automatically refreshed if needed
  console.log('Current user:', person.displayName);
}).catch(error => {
  if (error.message.includes('unauthorized')) {
    // Refresh failed, user needs to re-authenticate
    webex.authorization.initiateLogin();
  }
});

// Listen for token refresh events
webex.credentials.on('change:supertoken', () => {
  console.log('Token was refreshed');
});
```

### 5.4 Browser JWT Refresh

Browser JWT refresh using callback:

```javascript
// Configure JWT refresh callback
const webex = Webex.init({
  credentials: {
    jwtRefreshCallback: async (webex) => {
      // Get new JWT from your backend
      const response = await fetch('/api/jwt-refresh', {
        method: 'POST',
        credentials: 'include'
      });
      const { jwt } = await response.json();
      return jwt;
    }
  }
});

// SDK automatically uses jwtRefreshCallback when JWT expires
```

**Reference**: JWT refresh implementation in browser authorization plugin

---

## 6. Browser Ready and Authorization Events

### 6.1 Browser SDK Initialization Lifecycle

Browser SDK initialization phases:

1. **Construction**: Basic object creation
2. **Plugin Loading**: Authorization and other plugins initialize
3. **Storage Loading**: Browser storage data retrieval
4. **Authentication Check**: Token validation and refresh
5. **Ready State**: All systems operational

### 6.2 Browser Authorization Events

Browser-specific events:

```javascript
// Listen for SDK ready event
webex.once('ready', () => {
  console.log('Webex SDK is ready and authenticated');
});

// Listen for unauthorized event
webex.on('unauthorized', () => {
  console.log('User authentication lost - redirect to login');
  webex.authorization.initiateLogin();
});

// Listen for logout event
webex.on('client:logout', () => {
  console.log('User has logged out');
});
```

Events:

- **ready**: SDK fully initialized and authenticated
- **unauthorized**: User authentication lost
- **client:logout**: User has logged out

### 6.3 Browser Authentication Status

Check browser authentication status:

```javascript
// Check if user can make authenticated requests
if (webex.canAuthorize) {
  console.log('User is authenticated');
  // Make API calls
} else {
  console.log('User needs to login');
  webex.authorization.initiateLogin();
}

// Check if authorization is in progress
if (webex.authorization.isAuthorizing) {
  console.log('Authorization in progress...');
}

// Check if SDK is fully ready
if (webex.ready) {
  console.log('SDK is fully initialized');
}
```

Status Properties:

- `webex.canAuthorize`: Boolean for authenticated requests capability
- `webex.authorization.isAuthorizing`: Boolean for authorization in progress
- `webex.ready`: Boolean for SDK fully initialized

### 6.4 Browser Ready State Dependencies

Browser ready state depends on:

- **Credentials loaded** from browser storage
- **All plugins initialized**
- **Services catalog loaded**
- **Authentication state established**

---

## Browser Code References

- **Main Browser Plugin**: `packages/@webex/plugin-authorization-browser/src/authorization.js`
- **Browser Auth Sample**: `docs/samples/browser-auth/app.js`
- **Browser Plugin Docs**: `packages/@webex/plugin-authorization-browser/README.md`

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
