
export const GROUNDSKEEPER_INTERVAL = 20 * 1000; // 20 seconds in ms

export const FETCH_DELAY = 300; // ms

export const UPDATE_PRESENCE_DELAY = 60 * 1000; // 1 minute in ms
export const EXPIRED_PRESENCE_TIME = 10 * 60 * 1000; // 10 minutes in ms

export const SUBSCRIPTION_DELAY = 60 * 1000; // 1 minute in ms
export const PREMATURE_EXPIRATION_SUBSCRIPTION_TIME = 60 * 1000; // 1 minute in ms
export const DEFAULT_SUBSCRIPTION_TTL = 10 * 60 * 1000; // 10 minutes in ms

export const APHELEIA_SUBSCRIPTION_UPDATE =
  'event:apheleia.subscription_update';
export const PRESENCE_UPDATE = 'updated';

export const ENVELOPE_TYPE = {
  SUBSCRIPTION: 'subscription',
  PRESENCE: 'presence',
  DELETE: 'delete'
};
