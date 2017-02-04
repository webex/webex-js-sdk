# @ciscospark/passport-ciscospark

[![license](https://img.shields.io/github/license/mashape/apistatus.svg)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> [Passport](http://passportjs.org/) strategy for authenticating with [Cisco Spark](https://developer.ciscospark.com)

## Install

```bash
npm install --save @ciscospark/passport-ciscospark
```

## Usage

The following snippet shows how to initialize the `CiscoSparkStrategy`. Please see the [Passport docs](http://passportjs.com) for details on how to use passport in in general.

```javascript
const CiscoSparkStrategy = require(`@ciscosark/passport-ciscospark`).Strategy;

app.use(new CiscoSparkStrategy({
  client_id,
  client_secret,
  redirect_uri,
}, (accessToken, refreshToken, profile, done) => {
  User.findOne({id: profile.id}, (err, user) ={
    if (err) {
      done(err);
      return;
    }

    if (!user) {
      done(null, false);
      return;
    }

    user.update(profile, (err2) => {
      if (err2) {
        done(err2, user);
        return;
      }
    });
  });
}));
```

## API

### options.authorization_url || options.authorizationURL || process.env.CISCOSPARK_AUTHORIZATION_URL
- default: `https://idbroker.webex.com/idb/oauth2/v1/authorize`

### options.token_url || options.tokenUrl || process.env.CISCOSPARK_TOKEN_URL
- default: `https://idbroker.webex.com/idb/oauth2/v1/access_token`

### options.client_id || options.clientID || process.env.CISCOSPARK_CLIENT_ID

### options.client_secret || options.clientSecret || process.env.CISCOSPARK_CLIENT_SECRET

### options.redirect_uri || options.redirectUri || options.callbackURL || process.env.CISCOSPARK_REDIRECT_URI

### options.scope || process.env.CISCOSPARK_SCOPE

### options.Spark
- default: `require(\`ciscospark\`)`

SDK constructor to use for each request. Defaults to the [standard Cisco Spark SDK](https://www.npmjs.com/package/ciscospark) but a custom constructor can be passed in for internal projects.

### Strategy.prototype.userProfile

By default, this strategy uses the [/people/me](https://developer.ciscospark.com/endpoint-people-me-get.html) endpoint to get the user's profile on every successful login, but an alternate function can be specified here.

### Maintainers

Ciso [Spark for Developers](https://developer.ciscospark.com/)

### Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

### License

[See LICENSE File](LICENSE)
