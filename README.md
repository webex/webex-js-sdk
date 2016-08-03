# Cisco Spark JavaScript SDKs

## Ciscospark

[ciscospark](/packages/ciscospark) is a collection of node modules targeting our [external APIs](https://developers.ciscospark.com). Its core libraries take inspiration from our web client's Legacy SDK.

```bash
npm install --save ciscospark
```

### Building

At this time, a prebuilt version of ciscospark is not available. If your project already uses [browserify](http://browserify.org), or [webpack](https://webpack.github.io/) this shouldn't be an issue. If not, install the `@ciscospark/bundle` package from npm, which will automatically build a bundle for you in a post-install step.

Note that when when building for the browser, you'll need define
-  `CISCOSPARK_ACCESS_TOKEN`
or
- `CISCOSPARK_CLIENT_ID`
- `CISCOSPARK_CLIENT_SECRET`
- `CISCOSPARK_REDIRECT_URI`
- `CISCOSPARK_SCOPE`

> For production builds, set `NODE_ENV=production`.

```bash
CISCOSPARK_CLIENT_ID=<cliend id> CISCOSPARK_CLIENT_SECRET=<client secret> CISCOSPARK_REDIRECT_URI=<redirect uri> CISCOSPARK_SCOPE=<scope> npm install @ciscospark/bundle

ls
# =>
# |-node_modules/@ciscospark/bundle
# |-bundle.js
```

## Legacy SDK

The Ciscospark Legacy SDK makes up the core of our web client. As its functionality gets further modularized, it will be replaced by the plugins that make up Ciscospark.

See the internal GitHub Enterprise Wiki Page for more information on the legacy SDK

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
