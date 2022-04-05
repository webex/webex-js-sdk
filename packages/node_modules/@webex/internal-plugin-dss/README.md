# @webex/internal-plugin-dss

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for Directory Search Service (DSS)

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-dss
```

## Usage

```js
import '@webex/internal-plugin-dss';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();

// Namespace.
webex.internal.dss

// Register the plugin (connects to mercury).
webex.internal.dss.register()
  .then(() => {}) // On successful registration.
  .catch(() => {}); // On failed registration.

// Unregister the plugin (disconnects from mercury).
webex.internal.dss.unregister()
  .then(() => {}) // On successful unregistration.
  .catch(() => {}); // On failed unregistration.

// Methods

// Get detailed information on an entity
webex.internal.dss.lookupDetail({id: <entity-uuid>}).then((results) => {})

// Get information on multiple identities
webex.internal.dss.lookup({ids: [<entity-uuid-1>, <entity-uuid-2>]}).then((results) => {})

// If you know the entity provider, you can speed up the query
webex.internal.dss.lookup({
  ids: [<entity-uuid-1>, <entity-uuid-2>],
  entityProviderType: 'CI_USER'
}).then((results) => {})

// Get information on entities by querying their email addresses
webex.internal.dss.lookupByEmail(
  {emails: ['email1@example.com', 'email2@example.com']}
).then((results) => {})

// Search for information on certain type(s)
webex.internal.dss.search({
  requestedTypes: [PERSON],
  queryString: 'a name',
  resultSize: 10,
}).then((results) => {})
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2022 Cisco and/or its affiliates. All Rights Reserved.
