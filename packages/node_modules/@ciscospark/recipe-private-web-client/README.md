# @ciscospark/recipe-private-web-client

See https://ciscospark.github.io/spark-js-sdk/

This is a plugin recipe for the Cisco Spark JavaScript SDK. This recipe uses internal APIs to provide the features needed by the Cisco Spark Web Client. There is no guarantee of non-breaking changes. Non-Cisco engineers should stick to the `ciscospark` package.

## Usage

```javascript
import CiscoSpark from `@ciscospark/recipe-private-web-client`;

const spark = new CiscoSpark({
  config: ...
});
```

### Development

This package is npm linkable. Much of the initial setup is handled through some wonky npm scripts. When you call `npm link` in this directory, it'll do the normal `npm link`, but follow that up with bootstrapping and building the full sdk.

The rebuild only happens when `npm link` is called. You'll need to rebuild to get your changes to work. (Through some future babel, browserify, or webpack magic, we'll rig it up so that manual rebuild is not necessary).
