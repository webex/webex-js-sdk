# Upgrading to Webex

Follow this guide to upgrade from Cisco Spark to Webex.

## Environment variables

**Rename these environment variables**

| old                        | new                   |
| -------------------------- | --------------------- |
| `CISCOSPARK_ACCESS_TOKEN`  | `WEBEX_ACCESS_TOKEN`  |
| `CISCOSPARK_APPID_ORGID`   | `WEBEX_APPID_ORGID`   |
| `CISCOSPARK_APPID_SECRET`  | `WEBEX_APPID_SECRET`  |
| `CISCOSPARK_CLIENT_ID`     | `WEBEX_CLIENT_ID`     |
| `CISCOSPARK_CLIENT_SECRET` | `WEBEX_CLIENT_SECRET` |
| `CISCOSPARK_LOG_LEVEL`     | `WEBEX_LOG_LEVEL`     |
| `CISCOSPARK_REDIRECT_URI`  | `WEBEX_REDIRECT_URI`  |
| `CISCOSPARK_SCOPE`         | `WEBEX_SCOPE`         |

## Package

**Replace package references to `ciscospark` with `webex`**

```js
// old
require('ciscospark');
```

_**becomes**_

```js
// new
require('webex');
```

## Constructor

**Replace any references to `CiscoSpark` with `Webex`**

```js
// old
CiscoSpark.init({
  config: { ... }
});
```

_**becomes**_

```js
// new
Webex.init({
  config: { ... }
});
```

**Replace any references to `spark-core` with `webex-core`**

```js
import CiscoSpark from '@ciscospark/spark-core';
// old
const spark = CiscoSpark.init({
  config: { ... }
});
```

_**becomes**_

```js
import WebexCore from '@webex/webex-core';
// new
const webex = WebexCore.init({
  config: { ... }
});
```

## Plugins

**Replace any references to `SparkPlugin` with `WebexPlugin`**

```js
import {SparkPlugin} from '@ciscospark/spark-core';

const Avatar = SparkPlugin.extend({
  namespace: 'Avatar',
  ...
```

_**becomes**_

```js
import {WebexPlugin} from '@webex/webex-core';

const Avatar = WebexPlugin.extend({
  namespace: 'Avatar',
  ...
```
