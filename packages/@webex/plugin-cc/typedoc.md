# Webex JS SDK: Contact Center Plugin

Welcome to the documentation for the **@webex/plugin-cc** package, part of the [Webex JS SDK](https://github.com/webex/webex-js-sdk). This plugin provides APIs and utilities for integrating Webex Contact Center features into your JavaScript applications.

## Overview

- **Modular**: Integrates seamlessly with the Webex JS SDK.
- **Feature-rich**: Access Contact Center capabilities such as agent management, task handling, and more.
- **Type-safe**: Built with TypeScript for robust type checking and developer experience.

## Getting Started

```bash
npm install @webex/plugin-cc
```

Add the plugin to your Webex SDK instance:

```js
import Webex from '@webex/plugin-cc';

// Initialize Webex SDK with default configuration
const webex = Webex.init();
```

Or, initialize with a custom configuration:

```js
import Webex from '@webex/plugin-cc';

const customConfig = {
  logger: {
    level: 'debug', // Enable debug logging
    bufferLogLevel: 'log', // Used for upload logs
  },
  credentials: {
    access_token: 'your-access-token',
  },
  cc: {
    allowMultiLogin: false, // Disallow multiple logins
    allowAutomatedRelogin: true, // Enable automated re-login
    clientType: 'WebexCCSDK', // Specify the Contact Center client type
    isKeepAliveEnabled: false, // Disable keep-alive functionality
    force: true, // Force CC-specific configurations
    metrics: {
      clientName: 'WEBEX_JS_SDK', // Metrics client name
      clientType: 'WebexCCSDK', // Metrics client type
    },
  },
};

// Initialize Webex SDK with custom configuration
const webex = Webex.init({config: customConfig});
```

For access token refer <a target="_blank" href="https://developer.webex.com/meeting/docs/getting-started">here</a>.

### Configuration Reference

The `Webex.init` method accepts an optional configuration object to customize SDK behavior:

| Option                            | Type      | Default          | Description                               |
| --------------------------------- | --------- | ---------------- | ----------------------------------------- |
| `config.logger.level`             | `string`  | `'info'`         | Logging level (`'debug'`, `'info'`, etc.) |
| `config.logger.bufferLogLevel`    | `string`  | `'log'`          | Log buffering level for uploads           |
| `config.cc.allowMultiLogin`       | `boolean` | `false`          | Allow multiple logins                     |
| `config.cc.allowAutomatedRelogin` | `boolean` | `true`           | Enable automated re-login                 |
| `config.cc.clientType`            | `string`  | `'WebexCCSDK'`   | Type of the Contact Center client         |
| `config.cc.isKeepAliveEnabled`    | `boolean` | `false`          | Enable keep-alive functionality           |
| `config.cc.force`                 | `boolean` | `true`           | Force CC-specific configurations          |
| `config.cc.metrics.clientName`    | `string`  | `'WEBEX_JS_SDK'` | Metrics client name                       |
| `config.cc.metrics.clientType`    | `string`  | `'WebexCCSDK'`   | Metrics client type                       |

For a full list of configuration options, see the <a href="https://developer.webex.com/meeting/docs/sdks/webex-meetings-sdk-web-quickstart#webex-object-attribute-reference" target="_blank" rel="noopener noreferrer">Webex Object Attribute Reference</a>.

## Class Hierarchy

- [`Contact Center`](./classes/ContactCenter.html) - Click here if you want to learn more about `Agent based operations` such as station login, user state management, outdial, and related functionalities.

- [`Task`](./classes/Task.html) - Click here to learn more about task-based operations such as mute, unmute, hold, and transfer

## Support

For issues and feature requests, please visit <a href="https://github.com/webex/webex-js-sdk/issues" target="_blank">the GitHub repository</a>

---
