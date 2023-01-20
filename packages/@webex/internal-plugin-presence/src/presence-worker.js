import {debounce} from 'lodash';

import {
  FETCH_DELAY,
  GROUNDSKEEPER_INTERVAL,
  SUBSCRIPTION_DELAY,
  UPDATE_PRESENCE_DELAY,
  EXPIRED_PRESENCE_TIME,
  PREMATURE_EXPIRATION_SUBSCRIPTION_TIME,
  DEFAULT_SUBSCRIPTION_TTL,
  APHELEIA_SUBSCRIPTION_UPDATE,
  PRESENCE_UPDATE,
  ENVELOPE_TYPE,
} from './constants';

/**
 * Presence Worker
 * Manages fetches and subscriptions for presence
 * @class
 */
export default class PresenceWorker {
  /**
   * Constructs a presence worker to execute and
   * maintain tasks related to presence upkeep.
   * @returns {undefined}
   */
  constructor() {
    this.presences = {}; // current presence objects; updated time
    this.watchers = {}; // counter of visible presence-required objects
    this.fetchers = {}; // waiting to get presence object
    this.flights = {}; // in flight to get presence object
    this.campers = {}; // waiting to subscribe; updated time
    this.subscribers = {}; // current subscriptions; expiration time
  }

  /**
   * Connect to the mercury for presence and starts worker.
   * @param {object} webex
   * @returns {undefined}
   */
  initialize(webex) {
    if (!webex || !webex.internal) {
      throw new Error('Must initialize Presence Worker with webex!');
    }

    this.webex = webex;

    const mercury = this.webex.internal.mercury.connected
      ? Promise.resolve()
      : this.webex.internal.mercury.connect();

    mercury.then(() => {
      this.webex.internal.mercury.on(
        APHELEIA_SUBSCRIPTION_UPDATE,
        this.subscriptionUpdate.bind(this)
      );
    });

    setInterval(this.groundskeeper.bind(this), GROUNDSKEEPER_INTERVAL);
  }

  /**
   * Trigger a subscription update event.
   * @param {string} event
   * @returns {undefined}
   */
  subscriptionUpdate(event) {
    this.presences[event.data.subject] = new Date().getTime();

    this.webex.internal.presence.emitEvent(PRESENCE_UPDATE, {
      type: ENVELOPE_TYPE.SUBSCRIPTION,
      payload: event.data,
    });
  }

  /**
   * Retrieves and subscribes to a user's presence.
   * @param {string} id
   * @returns {undefined}
   */
  enqueue(id) {
    const now = new Date().getTime();

    if (this.watchers[id]) {
      this.watchers[id] += 1;
    } else {
      this.watchers[id] = 1;
    }

    if (this.subscribers[id]) {
      return;
    }

    if (!this.campers[id]) {
      this.campers[id] = now;
    }

    // Retrieve presence if:
    // not in flight or
    // don't already have the presence or
    // presence has gone stale
    if (
      !this.flights[id] &&
      (!this.presences[id] || this.presences[id] < now - UPDATE_PRESENCE_DELAY)
    ) {
      this.fetchers[id] = id;
      this.debouncedFetch();
    }
  }

  /**
   * Retract from subscribing to a user's presence.
   * @param {string} id
   * @returns {undefined}
   */
  dequeue(id) {
    if (this.watchers[id]) {
      this.watchers[id] -= 1;

      if (this.watchers[id] <= 0) {
        delete this.watchers[id];
        delete this.fetchers[id];
        delete this.campers[id];
      }
    }
  }

  /**
   * Retrieve users' presences.
   * @returns {undefined}
   */
  checkFetchers() {
    const boarding = this.fetchers;

    Object.assign(this.flights, boarding);
    this.fetchers = {};

    this.webex.internal.presence.list(Object.keys(boarding)).then((response) => {
      const now = new Date().getTime();

      response.statusList.forEach((presence) => {
        const id = presence.subject;

        delete this.flights[id];
        this.presences[id] = now;
      });

      this.webex.internal.presence.emitEvent(PRESENCE_UPDATE, {
        type: ENVELOPE_TYPE.PRESENCE,
        payload: response,
      });
    });
  }

  debouncedFetch = debounce(this.checkFetchers, FETCH_DELAY);

  /**
   * Determine if we should subscribe to users' presences.
   * @returns {Array}: User ids to subscribe.
   */
  checkCampers() {
    const now = new Date().getTime();
    const subscribers = [];

    Object.entries(this.campers).forEach((camper) => {
      const id = camper[0];
      const time = camper[1];

      // Subscribe if they've been camping for a minute
      if (time < now - SUBSCRIPTION_DELAY) {
        delete this.campers[id];
        this.subscribers[id] = null;
        subscribers.push(id);
      }
    });

    return subscribers;
  }

  /**
   * Determine if we should re-subscribe or remove users' subscriptions.
   * @returns {Array}: User ids to re-subscribe.
   */
  checkSubscriptions() {
    const now = new Date().getTime();

    const renewIds = [];

    Object.entries(this.subscribers).forEach((subscription) => {
      const id = subscription[0];
      const expiration = subscription[1];

      if (expiration) {
        // Renew subscription if they're about to expire
        if (this.watchers[id] && now > expiration - PREMATURE_EXPIRATION_SUBSCRIPTION_TIME) {
          renewIds.push(id);
        } else if (now > expiration) {
          delete this.subscribers[id];
        }
      }
    });

    return renewIds;
  }

  /**
   * Remove expired presence objects.
   * @returns {undefined}
   */
  cleanPresences() {
    const trash = [];
    const tenMinutesAgo = new Date().getTime() - EXPIRED_PRESENCE_TIME;

    Object.entries(this.presences).forEach((presence) => {
      const id = presence[0];
      const lastUpdated = presence[1];

      // Delete the object if it is stale
      if (lastUpdated < tenMinutesAgo) {
        delete this.presences[id];
        trash.push(id);
      }
    });

    // Tells client to delete it too
    if (trash.length) {
      this.webex.internal.presence.emitEvent(PRESENCE_UPDATE, {
        type: ENVELOPE_TYPE.DELETE,
        payload: trash,
      });
    }
  }

  /**
   * Execute chores on an interval.
   * Checks if we should make new subscribe,
   * checks if we should re-subscribe,
   * removes expired subscriptions,
   * removes expired presence objects.
   * @returns {undefined}
   */
  groundskeeper() {
    const campers = this.checkCampers();
    const renewSubscriptions = this.checkSubscriptions();

    const ids = [...campers, ...renewSubscriptions];

    if (ids.length) {
      this.webex.internal.presence.subscribe(ids).then((body) => {
        const now = new Date().getTime();

        body.responses.forEach((response) => {
          if (response.responseCode === 200) {
            const ttl = response.subscriptionTtl * 1000;

            this.subscribers[response.subject] = now + ttl;
            this.presences[response.status.subject] = now;
          } else {
            // If it errored for any reason, set the ttl so we clean it out eventually
            this.subscribers[response.subject] = now + DEFAULT_SUBSCRIPTION_TTL;
          }
        });
      });
    }

    this.cleanPresences();
  }
}
