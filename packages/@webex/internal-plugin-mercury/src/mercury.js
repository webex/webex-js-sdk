/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import url from 'url';

import {WebexPlugin} from '@webex/webex-core';
import {deprecated, oneFlight} from '@webex/common';
import {camelCase, get, set} from 'lodash';
import backoff from 'backoff';

import Socket from './socket';
import {
  BadRequest,
  Forbidden,
  NotAuthorized,
  UnknownResponse,
  ConnectionError
  // NotFound
} from './errors';

const normalReconnectReasons = [
  'idle',
  'done (forced)',
  'pong not received',
  'pong mismatch'
];

const Mercury = WebexPlugin.extend({
  namespace: 'Mercury',

  session: {
    connected: {
      default: false,
      type: 'boolean'
    },
    connecting: {
      default: false,
      type: 'boolean'
    },
    socket: 'object',
    localClusterServiceUrls: 'object'
  },

  derived: {
    listening: {
      deps: ['connected'],
      fn() {
        return this.connected;
      }
    }
  },

  @oneFlight
  connect(webSocketUrl) {
    if (this.connected) {
      this.logger.info('mercury: already connected, will not connect again');

      return Promise.resolve();
    }

    this.connecting = true;

    return Promise.resolve(this.webex.internal.device.registered || this.webex.internal.device.register())
      .then(() => {
        this.logger.info('mercury: connecting');

        return this._connectWithBackoff(webSocketUrl);
      });
  },

  @oneFlight
  disconnect() {
    return new Promise((resolve) => {
      if (this.backoffCall) {
        this.logger.info('mercury: aborting connection');
        this.backoffCall.abort();
      }

      if (this.socket) {
        this.socket.removeAllListeners('message');
        this.once('offline', resolve);
        this.socket.close();

        return;
      }

      resolve();
    });
  },

  @deprecated('Mercury#listen(): Use Mercury#connect() instead')
  listen() {
    /* eslint no-invalid-this: [0] */
    return this.connect();
  },

  @deprecated('Mercury#stopListening(): Use Mercury#disconnect() instead')
  stopListening() {
    /* eslint no-invalid-this: [0] */
    return this.disconnect();
  },

  processRegistrationStatusEvent(message) {
    this.localClusterServiceUrls = message.localClusterServiceUrls;
  },

  _applyOverrides(event) {
    if (!event || !event.headers) {
      return;
    }
    const headerKeys = Object.keys(event.headers);

    headerKeys.forEach((keyPath) => {
      set(event, keyPath, event.headers[keyPath]);
    });
  },

  _prepareUrl(webSocketUrl) {
    if (!webSocketUrl) {
      webSocketUrl = this.webex.internal.device.webSocketUrl;
    }

    return this.webex.internal.feature.getFeature('developer', 'web-high-availability')
      .then((haMessagingEnabled) => {
        if (haMessagingEnabled) {
          return this.webex.internal.services.convertUrlToPriorityHostUrl(webSocketUrl);
        }

        return webSocketUrl;
      })
      .then((wsUrl) => {
        webSocketUrl = wsUrl;
      })
      .then(() => this.webex.internal.feature.getFeature('developer', 'web-shared-mercury'))
      .then((webSharedMercury) => {
        webSocketUrl = url.parse(webSocketUrl, true);
        Object.assign(webSocketUrl.query, {
          outboundWireFormat: 'text',
          bufferStates: true,
          aliasHttpStatus: true
        });

        if (webSharedMercury) {
          Object.assign(webSocketUrl.query, {
            mercuryRegistrationStatus: true,
            isRegistrationRefreshEnabled: true
          });
          Reflect.deleteProperty(webSocketUrl.query, 'bufferStates');
        }

        if (get(this, 'webex.config.device.ephemeral', false)) {
          webSocketUrl.query.multipleConnections = true;
        }

        return url.format(webSocketUrl);
      });
  },

  _attemptConnection(socketUrl, callback) {
    const socket = new Socket();
    let attemptWSUrl;

    socket.on('close', (...args) => this._onclose(...args));
    socket.on('message', (...args) => this._onmessage(...args));
    socket.on('sequence-mismatch', (...args) => this._emit('sequence-mismatch', ...args));

    Promise.all([this._prepareUrl(socketUrl), this.webex.credentials.getUserToken()])
      .then(([webSocketUrl, token]) => {
        if (!this.backoffCall) {
          const msg = 'mercury: prevent socket open when backoffCall no longer defined';

          this.logger.info(msg);

          return Promise.reject(new Error(msg));
        }

        attemptWSUrl = webSocketUrl;

        let options = {
          forceCloseDelay: this.config.forceCloseDelay,
          pingInterval: this.config.pingInterval,
          pongTimeout: this.config.pongTimeout,
          token: token.toString(),
          trackingId: `${this.webex.sessionId}_${Date.now()}`,
          logger: this.logger
        };

        // if the consumer has supplied request options use them
        if (this.webex.config.defaultMercuryOptions) {
          this.logger.info('mercury: setting custom options');
          options = {...options, ...this.webex.config.defaultMercuryOptions};
        }

        // Set the socket before opening it. This allows a disconnect() to close
        // the socket if it is in the process of being opened.
        this.socket = socket;

        return socket.open(webSocketUrl, options);
      })
      .then(() => {
        this.webex.internal.metrics.submitClientMetrics('web-ha-mercury', {
          fields: {
            success: true
          },
          tags: {
            action: 'connected',
            url: attemptWSUrl
          }
        });
        callback();

        return this.webex.internal.feature.getFeature('developer', 'web-high-availability')
          .then((haMessagingEnabled) => {
            if (haMessagingEnabled) {
              return this.webex.internal.device.refresh();
            }

            return Promise.resolve();
          });
      })
      .catch((reason) => {
        // Suppress connection errors that appear to be network related. This
        // may end up suppressing metrics during outages, but we might not care
        // (especially since many of our outages happen in a way that client
        // metrics can't be trusted).
        if (reason.code !== 1006 && this.backoffCall && this.backoffCall.getNumRetries() > 0) {
          this._emit('connection_failed', reason, {retries: this.backoffCall.getNumRetries()});
        }
        this.logger.info('mercury: connection attempt failed', reason);
        // UnknownResponse is produced by IE for any 4XXX; treated it like a bad
        // web socket url and let WDM handle the token checking
        if (reason instanceof UnknownResponse) {
          this.logger.info('mercury: received unknown response code, refreshing device registration');

          return this.webex.internal.device.refresh()
            .then(() => callback(reason));
        }
        // NotAuthorized implies expired token
        if (reason instanceof NotAuthorized) {
          this.logger.info('mercury: received authorization error, reauthorizing');

          return this.webex.credentials.refresh({force: true})
            .then(() => callback(reason));
        }
        // // NotFound implies expired web socket url
        // else if (reason instanceof NotFound) {
        //   this.logger.info(`mercury: received not found error, refreshing device registration`);
        //   return this.webex.internal.device.refresh()
        //     .then(() => callback(reason));
        // }
        // BadRequest implies current credentials are for a Service Account
        // Forbidden implies current user is not entitle for Webex
        if (reason instanceof BadRequest || reason instanceof Forbidden) {
          this.logger.warn('mercury: received unrecoverable response from mercury');
          this.backoffCall.abort();

          return callback(reason);
        }
        if (reason instanceof ConnectionError) {
          return this.webex.internal.feature.getFeature('developer', 'web-high-availability')
            .then((haMessagingEnabled) => {
              if (haMessagingEnabled) {
                this.logger.info('mercury: received a generic connection error, will try to connect to another datacenter');
                this.webex.internal.metrics.submitClientMetrics('web-ha-mercury', {
                  fields: {
                    success: false
                  },
                  tags: {
                    action: 'failed',
                    error: reason.message,
                    url: attemptWSUrl
                  }
                });

                return this.webex.internal.services.markFailedUrl(attemptWSUrl);
              }

              return null;
            })
            .then(() => callback(reason));
        }

        return callback(reason);
      })
      .catch((reason) => {
        this.logger.error('mercury: failed to handle connection failure', reason);
        callback(reason);
      });
  },

  _connectWithBackoff(webSocketUrl) {
    return new Promise((resolve, reject) => {
      // eslint gets confused about whether or not call is actually used
      // eslint-disable-next-line prefer-const
      let call;
      const onComplete = (err) => {
        this.connecting = false;

        this.backoffCall = undefined;
        if (err) {
          this.logger.info(`mercury: failed to connect after ${call.getNumRetries()} retries; log statement about next retry was inaccurate; ${err}`);

          return reject(err);
        }
        this.connected = true;
        this._emit('online');

        return resolve();
      };

      // eslint-disable-next-line prefer-reflect
      call = backoff.call((callback) => {
        this.logger.info(`mercury: executing connection attempt ${call.getNumRetries()}`);
        this._attemptConnection(webSocketUrl, callback);
      }, onComplete);

      call.setStrategy(new backoff.ExponentialStrategy({
        initialDelay: this.config.backoffTimeReset,
        maxDelay: this.config.backoffTimeMax
      }));

      if (this.config.maxRetries) {
        call.failAfter(this.config.maxRetries);
      }

      call.on('abort', () => {
        this.logger.info('mercury: connection aborted');
        reject(new Error('Mercury Connection Aborted'));
      });

      call.on('callback', (err) => {
        if (err) {
          const number = call.getNumRetries();
          const delay = Math.min(call.strategy_.nextBackoffDelay_, this.config.backoffTimeMax);

          this.logger.info(`mercury: failed to connect; attempting retry ${number + 1} in ${delay} ms`);
          /* istanbul ignore if */
          if (process.env.NODE_ENV === 'development') {
            this.logger.debug('mercury: ', err, err.stack);
          }

          return;
        }
        this.logger.info('mercury: connected');
      });

      call.start();

      this.backoffCall = call;
    });
  },

  _emit(...args) {
    try {
      this.trigger(...args);
    }
    catch (error) {
      this.logger.error('mercury: error occurred in event handler', error);
    }
  },

  _getEventHandlers(eventType) {
    const [namespace, name] = eventType.split('.');
    const handlers = [];

    if (!this.webex[namespace] && !this.webex.internal[namespace]) {
      return handlers;
    }

    const handlerName = camelCase(`process_${name}_event`);

    if ((this.webex[namespace] || this.webex.internal[namespace])[handlerName]) {
      handlers.push({
        name: handlerName,
        namespace
      });
    }

    return handlers;
  },

  _onclose(event) {
    // I don't see any way to avoid the complexity or statement count in here.
    /* eslint complexity: [0] */

    try {
      const reason = event.reason && event.reason.toLowerCase();
      const socketUrl = this.socket.url;

      this.socket.removeAllListeners();
      this.unset('socket');
      this.connected = false;
      this._emit('offline', event);

      switch (event.code) {
        case 1003:
        // metric: disconnect
          this.logger.info(`mercury: Mercury service rejected last message; will not reconnect: ${event.reason}`);
          this._emit('offline.permanent', event);
          break;
        case 4000:
          // metric: disconnect
          this.logger.info('mercury: socket replaced; will not reconnect');
          this._emit('offline.replaced', event);
          break;
        case 1001:
        case 1005:
        case 1006:
        case 1011:
          this.logger.info('mercury: socket disconnected; reconnecting');
          this._emit('offline.transient', event);
          this._reconnect(socketUrl);
          // metric: disconnect
          // if (code == 1011 && reason !== ping error) metric: unexpected disconnect
          break;
        case 1000:
          if (normalReconnectReasons.includes(reason)) {
            this.logger.info('mercury: socket disconnected; reconnecting');
            this._emit('offline.transient', event);
            this._reconnect(socketUrl);
            // metric: disconnect
            // if (reason === done forced) metric: force closure
          }
          else {
            this.logger.info('mercury: socket disconnected; will not reconnect');
            this._emit('offline.permanent', event);
          }
          break;
        default:
          this.logger.info('mercury: socket disconnected unexpectedly; will not reconnect');
          // unexpected disconnect
          this._emit('offline.permanent', event);
      }
    }
    catch (error) {
      this.logger.error('mercury: error occurred in close handler', error);
    }
  },

  _onmessage(event) {
    const envelope = event.data;

    if (process.env.ENABLE_MERCURY_LOGGING) {
      this.logger.debug('mercury: message envelope: ', envelope);
    }

    const {data} = envelope;

    this._applyOverrides(data);

    return this._getEventHandlers(data.eventType)
      .reduce((promise, handler) => promise.then(() => {
        const {namespace, name} = handler;

        return new Promise((resolve) => resolve((this.webex[namespace] || this.webex.internal[namespace])[name](data)))
          .catch((reason) => this.logger.error(`mercury: error occurred in autowired event handler for ${data.eventType}`, reason));
      }), Promise.resolve())
      .then(() => {
        this._emit('event', event.data);
        const [namespace] = data.eventType.split('.');

        if (namespace === data.eventType) {
          this._emit(`event:${namespace}`, envelope);
        }
        else {
          this._emit(`event:${namespace}`, envelope);
          this._emit(`event:${data.eventType}`, envelope);
        }
      })
      .catch((reason) => {
        this.logger.error('mercury: error occurred processing socket message', reason);
      });
  },

  _reconnect(webSocketUrl) {
    this.logger.info('mercury: reconnecting');

    return this.connect(webSocketUrl);
  }
});

export default Mercury;
