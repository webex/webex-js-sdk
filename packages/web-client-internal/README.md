# @ciscospark/web-client-internal

See https://ciscospark.github.io/spark-js-sdk/

This is a simple package for loading all the internal plugins such that the Cisco Spark Web Client can easily be npm linked to the sdk repo during development.

Much of the initial setup is handled through some wonky npm scripts. When you call `npm link` in this directory, it'll do the normal `npm link`, but follow that up with bootstrapping and building the full sdk.

Note that this time, the rebuild only happens when `npm link` is called. You'll need to rebuild to get your changes to work. (Through some future babel, browserify, or webpack magic, we'll rig it up so that manual rebuild is not necessary).
