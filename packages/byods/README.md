### Bring Your Own Data Source (BYoDS) Node.JS SDK

### Table of Contents

- [Getting Started](#getting-started)
- [Developing](#developing)
- [Building](#building)
- [Testing](#testing)
- [Samples](#samples)
- [Consuming SDK](#consuming-sdk)
  - [NPM](#npm)
  - [Single organization setup](#single-organization-setup)

---

## Getting Started

The BYoDS Node.js SDK registers and manages data sources for one Webex organization per SDK instance. It provides Service App token management, custom token storage, JWS verification, and scheduled JWS renewal.

## Developing

```bash
git clone https://github.com/\<your-fork\>/webex-js-sdk.git
cd web-js-sdk/
yarn install
```

## Building

If your project needs some additional steps for the developer to build the
project after some code changes, state them here:

```bash
yarn workspace @webex/byods run build:src
```

## Testing

```bash
 yarn workspace @webex/byods run test:unit
```

## Samples

```bash
  yarn workspace byods-demo-server dev
```

## Consuming SDK

Use the following package name to install the SDK.

# NPM

```javascript
  npm install @webex/byods
```

(or)

```javascript
  yarn add @webex/byods
```

```javascript
  import {BYODS} from '@webex/byods';
```

## Single organization setup

Set the organization when you construct the SDK. Token methods use that organization and one stored token pair. Supply Service App tokens issued for this organization.

```javascript
import {BYODS} from '@webex/byods';

const sdk = new BYODS({clientId, clientSecret, orgId});

// Use a Service App refresh token obtained from Webex.
await sdk.tokenManager.saveServiceAppRegistrationData(refreshToken);

// Alternatively, obtain the pair using the Service App owner's PAT.
// await sdk.tokenManager.getServiceAppTokenUsingPAT(personalAccessToken);

const {data: sources} = await sdk.dataSource.list();
```

The default adapter stores one access token, refresh token, and their expiry times in memory. Each write replaces the stored pair. Access-token renewal is automatic when an expired token is requested. `sdk.tokenManager.deleteToken()` removes that pair.

A custom `TokenStorageAdapter` must implement `setToken(token: ServiceAppToken)`, `getToken()`, and `deleteToken()`. Use a separate adapter and storage record for each SDK instance. The adapter must return expiry values as `Date` objects. `ServiceAppToken`, `SDKConfig`, and `TokenStorageAdapter` are exported types.

DataSource responses include the Webex API's `orgId` metadata.
