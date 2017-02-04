/**!
 * Copyright (c) 2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import OAuth2Strategy from 'passport-oauth2';
import util from 'util';

/**
 * Use's ciscospark /people api to get the current user's details.
 * @param {ProxySpark} spark authorized spark instance
 * @private
 * @returns {Promise<Types~Person>}
 */
function getMe(spark) {
  if (spark.people) {
    return spark.people.get(`me`);
  }

  // We need to fallback to spark.request until the hydra plugins are split into
  // their own modules (at which point, this file should just always require
  // the people plugin).
  return spark.request({
    api: `hydra`,
    resource: `people/me`
  });
}

/**
 * Cisco Spark Passport Strategy
 * @example
 * passport.use(new CiscoSparkStrategy({
 *   clientID: `123-456-789`,
 *   clientSecret: `shhh-its-a-secret`,
 *   callbackURL: `https://www.example.net/auth/cisco-common-identity/callback`,
 *   scope: `webexsquared:get_conversation`,
 *   service: `spark`
 * },
 *   (accessToken, refreshToken, profile, done) => {
 *     User.findOrCreate(profile, (err, user) => {
 *       done(err, user);
 *     });
 *   }
 * ));
 * @param {Object} options
 * @param {Function} verify
 * @returns {Strategy}
 */
export function Strategy(options, verify) {
  /* eslint complexity: [0] */
  options = options || {};
  options.authorizationURL = options.authorization_url || options.authorizationURL || process.env.CISCOSPARK_AUTHORIZATION_URL || `https://idbroker.webex.com/idb/oauth2/v1/authorize`;
  options.tokenURL = options.token_url || options.tokenUrl || process.env.CISCOSPARK_TOKEN_URL || `https://idbroker.webex.com/idb/oauth2/v1/access_token`;
  options.scopeSeparator = `%20`;
  options.clientID = options.client_id || options.clientID || process.env.CISCOSPARK_CLIENT_ID;
  options.clientSecret = options.client_secret || options.clientSecret || process.env.CISCOSPARK_CLIENT_SECRET;
  options.callbackURL = options.redirect_uri || options.redirectUri || options.callbackURL || process.env.CISCOSPARK_REDIRECT_URI;
  options.scope = options.scope || process.env.CISCOSPARK_SCOPE;

  this._Spark = options.Spark || function Spark(...args) {
    // we only want to require ciscospark (and therefore load its proscribed set
    // set of plugins) if the consumer does not specify their own constructor.
    // eslint-disable-next-line global-require
    const ciscospark = require(`ciscospark`);
    return ciscospark.init(...args);
  };

  Reflect.apply(OAuth2Strategy, this, [options, verify]);

  this.name = `ciscospark`;
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);


/**
 * Fetches the user profile from the Identity Provider after a successful login.
 * @param {string} accessToken
 * @param {Function} done
 * @returns {null}
 */
Strategy.prototype.userProfile = function userProfile(accessToken, done) {
  const spark = new this._Spark({
    credentials: {
      // eslint-disable-next-line camelcase
      access_token: accessToken
    }
  });

  getMe(spark)
    .then((me) => {
      done(null, Object.assign({spark}, me));
    })
    .catch(done);
};
