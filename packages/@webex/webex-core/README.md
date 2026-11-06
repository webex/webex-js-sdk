# @webex/webex-core

Core library for the Cisco Webex JS SDK.

## Install

```bash
npm install --save @webex/webex-core
```

## What it Does

The webex-core package provides the foundational architecture for the Webex JavaScript SDK, including:

- Plugin system for loading and managing SDK plugins
- Storage system for data persistence across environments
- HTTP core for common request handling
- Credentials management for token handling
- Service discovery for dynamic endpoint resolution
- Logging framework for debugging

## Basic Usage

```js
import WebexCore from '@webex/webex-core';

// Create a basic Webex instance
const webex = new WebexCore({
  credentials: {
    access_token: 'your-access-token'
  }
});

// Use core functionality
webex.request({
  method: 'GET',
  uri: 'https://webexapis.com/v1/people/me'
}).then(response => {
  console.log('User info:', response.body);
});
```

## Configuration

### Requests without the SDK bearer token

Use `services.allowedWithoutAuthHeader` for domains that may receive requests
outside the service catalog and ordinary `allowedDomains`:

```js
services: {
  validateCatalogUrls: true,
  allowedWithoutAuthHeader: ['webex.com']
}
```

The default is `[]`. Matching uses the same domain helper as `allowedDomains`.
A plain domain covers itself and its subdomains. No path, scheme, or port policy
is added. Configure the list when creating the SDK instance.

Catalog and ordinary `allowedDomains` trust retain precedence. For example,
a catalogued home site still receives its normal authentication when
`webex.com` is also in the new list. A URL admitted only by the new list does not
receive an automatically attached SDK bearer token.
Auth removes any existing Bearer authorization header on this fallback.
This includes headers from callers and earlier SDK requests. It copies headers
before removal so the source request stays unchanged. Other authorization schemes
and transport authentication options retain their existing behavior.

The existing Catalog interceptor admits this fallback. The existing Auth
interceptor skips the SDK bearer token. Requests still use
`webex.request`, its normal transport, and its existing interceptor chain. The Auth
interceptor already honors `addAuthHeader: false` and
`shouldRefreshAccessToken: false`; this fallback sets those options and clears
an inherited SDK bearer token. It adds no request API or interceptor.

Existing per-request interceptor replacement remains application-controlled.
Matching uses existing absolute URLs; no URL-object, `baseUrl`, or runtime
configuration mechanism is added. Bodies and cookies retain existing behavior.
SDK redirect replay checks the new destination through the same request pipeline.
Native HTTP redirects inside XHR remain outside that mechanism.

### Client Scope Requirements

To utilize the basic functionality of the services plugin, the following scopes must be present in the client's scopes:

- `spark:all`

### Environment Variables

The following environment variables are used by this plugin:

- `HYDRA_SERVICE_URL` - Stores the public hydra api url for managing Webex resources
- `U2C_SERVICE_URL` - Stores the service catalog collecting url, typically the U2C service
- `SQDISCOVERY_SERVICE_URL` - Stores the URL for client region information, such as country code and timezone

### Advanced Configuration

The services plugin supports the ability to inject discovery urls via the constructor:

```js
const webex = new WebexCore({
  config: {
    services: {
      // Services that are available before catalog retrieval
      discovery: {
        hydra: 'https://api.ciscospark.com/v1',
        sqdiscovery: 'https://ds.ciscospark.com/v1/region'
      },

      // Services that have a persistent host, typically for testing
      override: {
        serviceName: 'https://api.service.com/v1'
      },

      // Validate domains against the allowed domains
      validateDomains: true,

      // The allowed domains to validate domains against. Each entry is a
      // hostname, matched on label boundaries: an entry allows that host and
      // its subdomains, so 'example.com' covers 'api.example.com' but not
      // 'notexample.com'.
      allowedDomains: ['example.com']
    }
  }
});
```

### Default Service URLs

The default configuration includes the following service urls:

- `U2C_SERVICE_URL` [U2C] - `https://u2c.wbx2.com/u2c/api/v1`
- `HYDRA_SERVICE_URL` [Hydra] - `https://webexapis.com/v1`
- `SQDISCOVERY_SERVICE_URL` [SQDISCOVERY] - `https://ds.ciscospark.com/v1/region`

## Plugin System

WebexCore provides a plugin architecture that allows extending functionality:

```js
import WebexCore from '@webex/webex-core';
import MyPlugin from './my-plugin';

// Register a plugin
WebexCore.registerPlugin('myPlugin', MyPlugin);

const webex = new WebexCore();
// Plugin is now available at webex.myPlugin
```

## Storage System

WebexCore includes a unified storage interface:

```js
// Configure storage adapter
const webex = new WebexCore({
  config: {
    storage: {
      adapter: 'localStorage' // or 'memory', 'indexedDB', etc.
    }
  }
});

// Use storage
webex.storage.put('key', 'value');
webex.storage.get('key').then(value => console.log(value));
```

This package is the foundation for all Webex SDK functionality and is required for most other Webex SDK packages.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
