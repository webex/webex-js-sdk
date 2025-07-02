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

      // The allowed domains to validate domains against
      allowedDomains: ['allowed-domain']
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
