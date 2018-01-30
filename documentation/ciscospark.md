# ciscospark

> The Cisco Spark JavaScript SDK

## Install

```bash
npm install --save ciscospark
```

## Usage

> All of the examples in these API docs assume you've gotten an authenticated CiscoSpark instance (unless otherwise specified) using one of the methods below.

`ciscospark` has three basic modes of operation:

- [As a shell script](#shell-script-quick-start)
- [On a nodejs server](#nodejs)
- [In a web browser](#browser)

### Shell Script (Quick Start)

This is the quickest way to get up and running with our JavaScript SDK. Simply set the environment variable `CISCOSPARK_ACCESS_TOKEN` to your access token and add the following line at the top of your JavaScript file to get a ready-to-use instance.

> You can get your `CISCOSPARK_ACCESS_TOKEN` from the [developer portal](https://developer.ciscospark.com).

```js
const ciscospark = require(`ciscospark/env`);
```

> `ciscospark/env` is also a great way to get started with [bots](https://developer.ciscospark.com/bots.html).

### Browser

Our JavaScript SDK provides out-of-the-box support for the [OAuth 2.0 Implicit Grant Flow](https://tools.ietf.org/html/rfc6749#section-4.2).

> You'll need to [register an OAuth Client](https://developer.ciscospark.com/add-integration.html) to get your "authorization string"

Use the steps under [Bundling](#bundling) (or something similar) to get the sdk into your browser, Then the following use the following JavaScript to get started.

```js
const ciscospark = CiscoSpark.init({
  config: {
    authorizationString: <your auth url>,
  }
});

ciscospark.once(`ready`, () => {
  if (ciscospark.canAuthorize) {
    /* Your application code goes here */
  }
  else {
    /* Your login code goes here */

    /*
      The following is a naive example of how to log in a user. Note that login should probably require a user action, otherwise errors can lead you into an infinite redirect loop.

      This will direct the user agent to the Cisco login page. Once the user logs in, they'll be redirected back to your app and the sdk will handle parsing the url.
    */
    ciscospark.authorization.initiateLogin();
  }
});

```

#### Bundling

You'll need to bundle the SDK to use it in a web browser. Right now, we do all our SDK testing with browserify, but our [Widgets Project](https://github.com/ciscospark/react-ciscospark) uses [webpack](https://webpack.github.io/).

The following snippet is the bare minimum to get our code into a form suitable for a web browser. You'll probably want to additionally pipe it through a minifier like [uglify](https://github.com/mishoo/UglifyJS2) before going to production.

```bash
npm install ciscospark
npm install -g browserify
echo "window.CiscoSpark = require('ciscospark')" > ./index.js
browserify index.js > bundle.js
```

Then, just load your bundle using

```html
<script src="/bundle.js"></script>
```

### NodeJS

Though the implicit flow is great for single page apps, it's not ideal for integrations that might need to do things on your users' behalf months in the future. We additionally support the [OAuth 2.0 Authorization Code Grant](https://tools.ietf.org/html/rfc6749#section-4.1) flow, but due to its complexity, there's a bit you'll need to wire up in your app to take advantage of it. The following is an example of how an Express app might do authentication.

```js
const CiscoSpark = require(`ciscospark`);
const assert = require(`assert`);

app.use(function(req, res, next) {
  req.spark = CiscoSpark.init({
    config: {
      credentials: {
        authorizationString: <your auth url>,
        client_secret: <your client secret>
      },
    }
  });

  req.spark.once(`ready`, next);
});

app.get(`/login`, (req, res) => {
  // buildLoginUrl() defaults to the implicit grant flow so explicitly pass
  // `confidential` to generate a url suitable to the Authorization Code grant
  // flow.
  res
    .redirect(req.spark.credentials.buildLoginUrl({clientType: 'confidential'}))
    .end();
});

app.get(`/oauth/redirect`, (req, res, next) => {
  assert(req.params.code);
  req.spark.requestAuthorizationCodeGrant(req.params)
    .then(() => {
      res.redirect(`/`).end();
    })
    .catch(next);
});
```