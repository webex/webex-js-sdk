/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var bindAll = require('lodash.bindall');
var clone = require('lodash.clone');
var defaults = require('lodash.defaults');
var helpers = require('./helpers');
var map = require('lodash.map');
var remove = require('lodash.remove');
var Spark = require('../../../src');
var TestUsersInterface = require('spark-js-sdk--test-users');

function formatUser(user) {
  console.log(JSON.stringify(user, null, 2));
}

function LandingParty() {
  this.redshirts = [];
  this.crewmembers = {};
  this.all = [];

  bindAll(this);
}

function genEmail(name) {
  return 'spark-js-sdk--' + name + '--' + Date.now() + '@wx2.example.com';
}

assign(LandingParty.prototype, {
  beamDown: function beamDown(members) {
    if (typeof members !== 'object') {
      throw new Error('`members` must be an object');
    }

    return Promise.all(map(members, function(shouldCreateClient, name) {
      if (this.crewmembers[name]) {
        members[name] = this.crewmembers[name];
        return this._beamDown(this.crewmembers[name]);
      }


      return this._beamDown('crewmember', {email: genEmail(name)}, {
        registerDevice: shouldCreateClient,
        listen: shouldCreateClient
      })
        .then(function(user) {
          members[name] = this.crewmembers[name] = user;
          return user;
        }.bind(this));
    }.bind(this)))
      .then(function() {
        return members;
      });
  },

  beamDownRedshirt: function beamDownRedshirt(options, userOptions) {
    options = options || {};
    userOptions = userOptions || {};
    userOptions.email = genEmail;
    if (options.createClient) {
      options = {
        registerDevice: true,
        listen: true
      };
    }

    return this._beamDown('redshirt', userOptions, options)
      .then(function(user) {
        this.redshirts.push(user);
        return user;
      }.bind(this));
  },

  beamUp: function beamUp(crewmember) {
    if (!crewmember) {
      var crewPromises = Promise.all(map(this.crewmembers, this.beamUp.bind(this)));
      var redshirtPromises = Promise.all(this.redshirts.map(this.beamUp.bind(this)));
      return Promise.all([
        crewPromises,
        redshirtPromises
      ])
        .then(function() {
          this.redshirts = [];
          this.crewmembers = {};
          this.all = [];
        }.bind(this))
        .catch(helpers.catch);
    }

    return this._beamUp('crewmember', crewmember)
      .catch(function(reason) {
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.error('failed to _beamUp()', formatUser(crewmember));
        }
        throw reason;
      });
  },

  killRedshirt: function killRedshirt(redshirt) {
    return this._beamUp('redshirt', redshirt)
      .catch(function(reason) {
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.error('failed to _beamUp()', formatUser(redshirt));
        }
        throw reason;
      });
  },

  _beamDown: function _beamDown(type, userOptions, options) {
    /* eslint complexity: [0] */
    var user;
    if (typeof type === 'object') {
      user = type;
      type = 'crewmember';
      options = {
        registerDevice: true,
        listen: true
      };
    }

    if (options.listen) {
      options.registerDevice = true;
    }

    if (!type || typeof type !== 'string') {
      return Promise.reject(new Error('`type` must be a string'));
    }

    if (userOptions) {
      if (!userOptions.email) {
        return Promise.reject(new Error('`options.email` is required'));
      }

      defaults(userOptions, {
        entitlements: [
          'spark',
          'squaredCallInitiation',
          'squaredRoomModeration',
          'squaredInviter',
          'webExSquared'
        ],
        scopes: process.env.COMMON_IDENTITY_SCOPE
      });
    }

    return Promise.resolve(user || TestUsersInterface.create(userOptions))
      .catch(function(reason) {
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.error('failed to create ' + type, reason, reason.stack);
        }
        throw reason;
      })
      .then(function(user) {
        this.all.push(user);
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.log('created ' + type, formatUser(user));
        }
        if (options.registerDevice) {
          return Promise.resolve(user.spark || this._makeSpark(user))
            .catch(function(reason) {
              if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
                console.error('failed to register device for ' + type, formatUser(user), reason);
              }
              throw reason;
            })
            .then(function() {
              if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
                console.log('registered device for ' + type, formatUser(user));
              }
              if (options.listen) {
                return Promise.resolve(user.spark.mercury.listening || user.spark.mercury.listen())
                  .catch(function(reason) {
                    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
                      console.error('failed to connect to mercury for ' + type, formatUser(user), reason);
                    }
                  })
                  .then(function() {
                    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
                      console.log('connected to mercury for ' + type, formatUser(user));
                    }
                    return user;
                  });
              }
              return user;
            });
        }
        return user;
      }.bind(this));
  },

  _beamUp: function _beamUp(type, user) {
    remove(this.all, {id: user.id});
    remove(this.redshirts, {id: user.id});
    remove(this.crewmembers, {id: user.id});

    return Promise.resolve(!user.spark || user.spark.mercury.disconnect())
      .catch(function(reason) {
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.warn('failed to close WebSocket for ' + type, (reason.body || reason));
        }
      })
      .then(function() {
        return TestUsersInterface.remove(user);
      })
      .then(function() {
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.log('delete crew member', formatUser(user));
        }
      })
      .catch(function(reason) {
        if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
          console.error('failed to delete ' + type, (reason.body || reason), formatUser(user));
        }
      });
  },

  _makeSpark: function _makeSpark(user) {
    user.spark = new Spark({
      credentials: {
        authorization: user.token
      },
      config: clone(require('../fixtures/spark-config'))
    });

    return user.spark.authenticate();
  }
});

module.exports = new LandingParty();
