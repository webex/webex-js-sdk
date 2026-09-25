# @webex/internal-plugin-conversation

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Conversation service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Rate-limit handling](#rate-limit-handling)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-conversation
```

## Usage

```js
import '@webex/internal-plugin-conversation';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.conversation.WHATEVER;
```

This is the list of environment variable used by this plugin:

- `WEBEX_CONVERSATION_DEFAULT_CLUSTER` - The name of the conversation cluster that contains all of the organizations and spaces prior to federation phase 2. This defaults to `urn:TEAM:us-east-2_a:identityLookup` for production but can be changed to `urn:TEAM:us-east-1_int13:identityLookup` for integration.
- `WEBEX_CONVERSATION_CLUSTER_SERVICE` - The name of the conversation cluster service used to lookup the host in the hostmap. Defaults to `identityLookup`, but if the service changes, will need to be updated.

## Rate-limit handling

The plugin provides an opt-in Conversation-specific interceptor. Enable it when creating the SDK instance:

```js
const webex = new WebexCore({
  config: {
    conversation: {
      enableRetryAfterInterceptor: true,
    },
  },
});
```

When a Conversation `GET` receives HTTP 429, the interceptor waits for the response's `Retry-After` value and
replays the request. Each request waits and retries independently, with a limit of three replays per request
(four total attempts, including the original request).
Missing or invalid delay values default to 30 seconds, and delays are capped at one hour.

The interceptor is reactive: fresh requests continue normally while replays are pending. Requests with the
same delay may replay concurrently. Requests that write data are never replayed, and requests to other services
are unaffected. Proactive admission control is outside this interceptor's scope.

Consumers that replace `config.interceptors` must also include `ConversationRetryAfterInterceptor`. The config
flag alone enables the interceptor only when the SDK uses its default interceptor set.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
