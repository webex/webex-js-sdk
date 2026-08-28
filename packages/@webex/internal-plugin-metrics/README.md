# @webex/internal-plugin-metrics

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Metrics service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Unhandled exception telemetry](#unhandled-exception-telemetry)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-metrics
```

## Usage

```js
import '@webex/internal-plugin-metrics';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.metrics.WHATEVER;
```

## Unhandled exception telemetry

Unhandled exception telemetry is currently supported only in browser environments. It starts after
the Webex SDK emits `ready`. It does not install a standalone collector, capture errors before SDK
initialization, persist events, or retry failed telemetry submissions.

The reporter captures uncaught errors, unhandled promise rejections, and resource load failures.
Matching failures captured in the same one-second in-memory window are submitted once with an
`occurrenceCount`. Non-HTTP(S) URLs are redacted; URL credentials, query parameters, and fragments
are stripped; and error names, messages, and stacks are truncated before submission.

Telemetry is disabled by default. Enable it with
`metrics.unhandledExceptionTelemetry.enabled: true`. Applications may provide a synchronous
`getMetadata` callback in the same configuration object. It must return an object whose fields can
include application context such as `orgId` and `dataCenter`. Metadata must not contain personally
identifiable information or credentials.

```js
import Webex from 'webex';

const webex = Webex.init({
  config: {
    metrics: {
      unhandledExceptionTelemetry: {
        enabled: true,
        getMetadata: () => ({
          orgId: 'your-organization-id',
          dataCenter: 'your-data-center',
        }),
      },
    },
  },
});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
