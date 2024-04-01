# @webex/internal-plugin-mercury

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Mercury service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-mercury
```

## Usage

```js
import '@webex/internal-plugin-mercury';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
webex.internal.mercury.WHATEVER;
```

## Using A Proxy Agent To Open A Websocket Connection

For consumers who are not using the SDK via the browser it may be necessary to configure a proxy agent in order to connect with Mercury and open a Websocket in a proxy environment.

This can be done by configuring an agent as part of a DefaultMercuryOptions config object as shown below. The agent object will then be injected into the SDK and used in the Mercury plugin during WebSocket construction as an option property, allowing a connection to be established via the specified proxy url.

```js
const webex = require(`webex`);
const HttpsProxyAgent = require('https-proxy-agent');

let httpsProxyAgent = new HttpsProxyAgent(url.parse(proxyUrl));

webex.init({
	config: {
	  defaultMercuryOptions: {
		agent: httpsProxyAgent
	  },
	 ...
	}
});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
