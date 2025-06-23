# Webex OAuth Authorization Flow - Overview Guide

This document provides an overview of how the Webex SDK handles OAuth authorization across different environments. For detailed environment-specific information, see the dedicated guides below.

## Environment-Specific Guides

### Browser OAuth Flow

For browser-based applications using the Webex SDK in web environments:

**📖 [BROWSER-OAUTH-FLOW-GUIDE.md](../plugin-authorization-browser/BROWSER-OAUTH-FLOW-GUIDE.md)**

Covers:

- Browser initialization and setup
- Implicit Grant vs Authorization Code Grant flows
- Browser-specific CSRF protection
- URL parsing and token extraction
- Browser storage and events

### Node.js OAuth Flow

For server-side applications using the Webex SDK in Node.js environments:

**📖 [NODE-OAUTH-FLOW-GUIDE.md](../plugin-authorization-node/NODE-OAUTH-FLOW-GUIDE.md)**

Covers:

- Server-side initialization and configuration
- Authorization Code Grant flow
- JWT authentication for server-to-server
- Secure token storage and management
- Server-side token refresh handling

## Quick Environment Detection

The Webex SDK automatically detects your environment and loads the appropriate authorization plugin:

### Browser Environment

- **Detects**: `window` object presence
- **Loads**: `@webex/plugin-authorization-browser`
- **Features**: URL parsing, browser storage, popup/redirect handling
- **Flows**: Implicit Grant (default), Authorization Code Grant

### Node.js Environment

- **Detects**: Node.js runtime
- **Loads**: `@webex/plugin-authorization-node`
- **Features**: Server-side token exchange, secure credential storage
- **Flows**: Authorization Code Grant (primary), JWT authentication

## Common OAuth Flow Steps

Regardless of environment, the OAuth flow follows these general steps:

1. **Initialization**: Configure SDK with client credentials and scopes
2. **Authorization**: Redirect user to Webex identity broker for authentication
3. **Code/Token Reception**: Receive authorization code or access token
4. **Token Exchange**: Exchange code for tokens (Authorization Code Grant)
5. **Token Storage**: Store and manage tokens securely
6. **Token Refresh**: Automatically refresh expired tokens
7. **API Access**: Make authenticated requests to Webex APIs

## Flow Type Comparison

| Aspect             | Implicit Grant        | Authorization Code Grant           |
| ------------------ | --------------------- | ---------------------------------- |
| **Client Type**    | Public                | Confidential                       |
| **Client Secret**  | Not required          | Required                           |
| **Security**       | Less secure           | More secure                        |
| **Token Location** | URL hash              | Server exchange                    |
| **Best For**       | SPAs, mobile apps     | Server apps, web apps with backend |
| **Supertoken**     | Basic token structure | Enhanced token with metadata       |

## Key Differences by Environment

### Browser-Specific Features

- **URL hash parsing** for token extraction
- **sessionStorage** for CSRF token storage
- **Popup window** support for authentication
- **Browser storage adapters** for token persistence
- **CORS handling** for API requests

### Node.js-Specific Features

- **Client secret** handling for secure authentication
- **Server-side token exchange** for Authorization Code Grant
- **Database/file storage** for token persistence
- **JWT creation and exchange** for guest authentication
- **Server-to-server** authentication flows

## Getting Started

1. **Choose your environment guide** based on where you're running the Webex SDK
2. **Follow the initialization steps** for your specific environment
3. **Implement the OAuth flow** appropriate for your application type
4. **Handle token management** according to your security requirements

For detailed implementation examples and code references, see the environment-specific guides linked above.

## Code References

- **Main Authorization Plugin**: `packages/@webex/plugin-authorization/`
- **Browser Plugin**: `packages/@webex/plugin-authorization-browser/`
- **Node.js Plugin**: `packages/@webex/plugin-authorization-node/`
- **WebexCore**: `packages/@webex/webex-core/src/webex-core.js`
- **Browser Sample**: `docs/samples/browser-auth/app.js`

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
