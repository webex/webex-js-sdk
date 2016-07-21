# Cisco Spark JavaScript SDKs

## Ciscospark

[ciscospark](/packages/ciscospark) is a collection of node modules targeting our [external APIs](https://developers.ciscospark.com). Its core libraries take inspiration from our web client's Legacy SDK.

```bash
npm install --save ciscospark
```

### Building

At this time, a prebuilt version of ciscospark is not available. If your project already uses [browserify](http://browserify.org), or [webpack](https://webpack.github.io/) this shouldn't be an issue. If not, you'll need to clone the repository and build it with:

```bash
npm install -g browserify
npm install
npm run bootstrap
npm run build
browserify --standalone ciscospark packages/ciscospark > bundle.js
```

> For production builds, change `npm run build` to `NODE_ENV=production npm run build`.

Note that when when building for the browser, you'll need define
-  `CISCOSPARK_ACCESS_TOKEN`
or
- `CISCOSPARK_CLIENT_ID`
- `CISCOSPARK_CLIENT_SECRET`
- `CISCOSPARK_REDIRECT_URI`
- `CISCOSPARK_SCOPE`

Alternatively, you can use use `ciscospark.init()` to set those values at runtime. See Environment Setup (below) and the (ciscospark)[packages/ciscospark/README.md] README for more info on those values.

## Legacy SDK

The Ciscospark Legacy SDK makes up the core of our web client. As its functionality gets further modularized, it will be replaced by the plugins that make up Ciscospark.

See the internal GitHub Enterprise Wiki Page for more information on the legacy SDK

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
