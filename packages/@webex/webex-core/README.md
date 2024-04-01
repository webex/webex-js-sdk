# @webex/webex-core

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Core library for the Cisco Webex JS SDK.

Defines the plugin system, storage system, common http behaviors, credentials, services, and basic logging.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/webex-core
```

## Usage

### Client Scope Requirements

To utilize the basic functionality of the `services` plugin that is bound to the `webex-core` plugin upon initialization, the following scopes must be present in the provided client's scopes:

- `spark:all`

### Environment Variables

The following environment variables are used by this plugin:

- `HYDRA_SERVICE_URL` - Stores the public hydra api url for managing Webex resources.
- `U2C_SERVICE_URL` - Stores the service catalog collecting url, typically the **U2C** service.

### Configuration

The `services` plugin that is bound to the `webex-core` plugin upon initialization supports the ability to inject discovery urls via the constructor:

```js
const webex = new Webex({
  config: {
    services: {
      // Services that are available before catalog retrieval.
      discovery: {
        hydra: 'https://api.ciscospark.com/v1'
      },

      // Services that have a persistant host, typically for testing.
      override: {
        serviceName: 'https://api.service.com/v1'
      }

      // Validate domains against the allowed domains.
      validateDomains: true,

      // The allowed domains to validate domains against.
      allowedDomains: ['allowed-domain']
    }
  }
});
```

The default configuration includes the following service urls:

- `U2C_SERVICE_URL` [ **U2C** ] - `https://u2c.wbx2.com/u2c/api/v1`
- `HYDRA_SERVICE_URL` [ **Hydra** ] - `https://api.ciscospark.com/v1`

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
