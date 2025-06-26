# Webex Node.js OAuth Authorization Flow - Technical Guide

This document explains how the Webex SDK handles OAuth authorization in Node.js environments, covering server-side authentication flows and token management.

## Table of Contents

[Node.js Webex Initialization](#1-nodejs-webex-initialization)
[Node.js OAuth Flow Types](#2-nodejs-oauth-flow-types)
[Authorization Code Exchange](#3-authorization-code-exchange)  
[Server-Side Token Management](#4-server-side-token-management)  
[Node.js Refresh Token Management](#5-nodejs-refresh-token-management)  
[Node.js Ready and Authorization Events](#6-nodejs-ready-and-authorization-events)

---

## 1. Node.js Webex Initialization

### 1.1 Basic Node.js Setup

Node.js applications initialize the Webex SDK with server-side OAuth parameters:

- **client_id**: Your registered application ID
- **client_secret**: Your application's client secret (required for server-side)
- **scope**: Requested permissions (e.g., 'spark:all spark:kms')
- **clientType**: 'confidential' (default for Node.js)

**Reference**: See `packages/@webex/plugin-authorization-node/README.md` for Node.js specific configuration

### 1.2 Node.js Environment Detection

The SDK automatically loads the Node.js authorization plugin:

- **Environment**: Detects Node.js runtime automatically
- **Plugin**: Loads `@webex/plugin-authorization-node`
- **Flow Type**: Defaults to Authorization Code Grant (confidential client)

**Reference**: Main authorization plugin in `packages/@webex/plugin-authorization/README.md`

### 1.3 Node.js vs Browser Differences

#### Node.js Environment Benefits

- **Security**: Client secret can be safely stored server-side
- **Token Management**: Enhanced server-side token handling
- **No URL Parsing**: No need to parse browser URLs for tokens
- **Server-to-Server**: Direct API authentication without user interaction

#### Node.js Limitations

- **No Browser Redirects**: Cannot redirect users to OAuth pages
- **Backend Only**: Requires separate frontend for user authentication flows
- **Server Infrastructure**: Needs server environment to run

---

## 2. Node.js OAuth Flow Types

### 2.1 Authorization Code Grant (Primary)

Node.js primarily uses Authorization Code Grant:

1. **Frontend initiates**: Browser redirects user to OAuth provider
2. **User authenticates**: At Webex identity broker
3. **Code received**: Authorization code sent to redirect URI
4. **Backend exchange**: Node.js exchanges code for tokens using client secret

### 2.2 JWT Authentication (Server-to-Server)

Node.js JWT authentication for guest/bot scenarios:

1. **Create JWT**: Server creates JWT with guest issuer credentials
2. **Exchange for token**: JWT exchanged for Webex access token
3. **API access**: Use access token for Webex API calls

**Reference**: JWT methods in Node.js authorization plugin

### 2.3 Client Credentials Flow

For server-to-server authentication without user context:

1. **Direct token request**: Using client_id and client_secret
2. **No user involvement**: Pure server-to-server authentication
3. **Limited scope**: Typically restricted to bot/integration scopes

---

## 3. Authorization Code Exchange

### 3.1 Node.js Code Reception

In Node.js environment, authorization code is received via:

1. **Redirect URI endpoint**: Your server handles the OAuth callback
2. **Code extraction**: Extract `code` parameter from query string
3. **State validation**: Verify state parameter for CSRF protection
4. **Error handling**: Check for OAuth error parameters

### 3.2 Node.js Token Exchange Process

Node.js performs secure token exchange:

1. **POST request** to OAuth token endpoint
2. **Parameters**:
   - grant_type: "authorization_code"
   - client_id: Your application ID
   - client_secret: Your application secret
   - code: Authorization code received
   - redirect_uri: Must match registered URI

### 3.3 Node.js Token Response

Successful exchange returns:

- **access_token**: For API authorization
- **refresh_token**: For token renewal
- **expires_in**: Token lifetime in seconds
- **token_type**: Usually "Bearer"
- **scope**: Granted permissions

**Reference**: Token exchange implementation in Node.js authorization plugin

---

## 4. Server-Side Token Management

### 4.1 Node.js Token Storage

Node.js token storage considerations:

1. **Secure storage**: Database, encrypted files, or secure key stores
2. **User association**: Link tokens to specific user accounts
3. **Session management**: Associate tokens with user sessions
4. **Encryption**: Encrypt tokens at rest

### 4.2 Node.js Supertoken Structure

Node.js can create enhanced supertoken structures:

- **Standard OAuth tokens**: access_token, refresh_token
- **Metadata**: User information, scope details
- **Expiration tracking**: Calculated expiry times
- **Custom fields**: Application-specific data

### 4.3 Node.js Token Validation

Server-side token validation:

1. **Expiry checking**: Validate token hasn't expired
2. **Scope verification**: Ensure token has required permissions
3. **Refresh triggers**: Automatic refresh when near expiry
4. **Error handling**: Handle invalid or revoked tokens

---

## 5. Node.js Refresh Token Management

### 5.1 Node.js Token Expiration Monitoring

Node.js monitors token expiration through:

- **Scheduled checks**: Periodic token validity verification
- **API response monitoring**: Watch for 401 Unauthorized responses
- **Proactive refresh**: Refresh before expiration
- **Retry logic**: Automatic retry with refreshed tokens

### 5.2 Node.js Refresh Process

Server-side refresh token flow:

1. **POST request** to token endpoint
2. **Parameters**:
   - grant_type: "refresh_token"
   - refresh_token: Current refresh token
   - client_id: Application identifier
   - client_secret: Application secret

### 5.3 Node.js Refresh Response Handling

Handle refresh response:

1. **Update stored tokens**: Replace old tokens with new ones
2. **Update user sessions**: Refresh tokens in active sessions
3. **Handle refresh failure**: Re-authenticate user if refresh fails
4. **Concurrent requests**: Handle multiple simultaneous refresh attempts

### 5.4 Node.js JWT Refresh

For JWT-based authentication:

1. **JWT expiration monitoring**: Track JWT token expiry
2. **Automatic renewal**: Create new JWT when needed
3. **Re-exchange process**: Exchange new JWT for fresh access token
4. **Callback integration**: Use jwtRefreshCallback for automation

**Reference**: JWT refresh implementation in Node.js authorization plugin

---

## 6. Node.js Ready and Authorization Events

### 6.1 Node.js SDK Initialization

Node.js SDK initialization phases:

1. **Module loading**: Load required Node.js modules
2. **Plugin initialization**: Initialize Node.js authorization plugin
3. **Configuration validation**: Validate client credentials
4. **Service discovery**: Load Webex service endpoints
5. **Ready state**: SDK ready for API calls

### 6.2 Node.js Authorization Events

Node.js-specific events:

- **ready**: SDK initialized and ready for requests
- **unauthorized**: Token invalid or expired
- **token:refresh**: Token has been refreshed
- **auth:error**: Authentication error occurred

### 6.3 Node.js Authentication Status

Check Node.js authentication status:

- `webex.canAuthorize`: Boolean for authenticated request capability
- `webex.credentials.supertoken`: Current token information
- `webex.ready`: Boolean for SDK initialization complete

### 6.4 Node.js Error Handling

Node.js specific error scenarios:

1. **Invalid client credentials**: Wrong client_id or client_secret
2. **Network failures**: Connection issues to Webex APIs
3. **Token expiry**: Handle expired tokens gracefully
4. **Rate limiting**: Handle API rate limit responses
5. **Service unavailability**: Handle Webex service outages

---

## Node.js Code References

- **Main Node.js Plugin**: `packages/@webex/plugin-authorization-node/`
- **Node.js Plugin Docs**: `packages/@webex/plugin-authorization-node/README.md`
- **WebexCore**: `packages/@webex/webex-core/src/webex-core.js`
- **Common Authorization**: `packages/@webex/plugin-authorization/README.md`

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
