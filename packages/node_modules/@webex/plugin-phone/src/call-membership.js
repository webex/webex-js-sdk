import AmpState from 'ampersand-state';

/**
 * @class
 */
const CallMembership = AmpState.extend({
  idAttribute: '_id',

  props: {
    /**
     * Internal identifier for keeping track of memberships. Will be replaced at
     * some future point with a proper {@link CallMembership#id} field.
     * @instance
     * @memberof CallMembership
     * @private
     * @readonly
     */
    _id: {
      required: true,
      type: 'string'
    },

    /**
     * Indicates if the member is the current user. (mostly just to simplify
     * searching the CallMemberships array)
     * @instance
     * @memberof CallMembership
     * @private
     * @readonly
     */
    isSelf: {
      default: false,
      type: 'boolean'
    },

    /**
     * Indicates if the member started the call
     * @instance
     * @memberof CallMembership
     * @type {boolean}
     * @readonly
     */
    isInitiator: {
      default: false,
      required: true,
      type: 'boolean'
    },

    /**
     * @instance
     * @memberof CallMembership
     * @type {string}
     * @readonly
     */
    personId: {
      type: 'string'
    },

    /**
     * Mostly here for testing and potentially for widget support. Do not use.
     * @instance
     * @memberof CallMembership
     * @private
     * @type {string}
     * @readonly
     */
    personUuid: {
      require: true,
      type: 'string'
    },

    /**
     * Indicates the member's relationship with the call. One of
     * - notified - the party has been invited to the call but has not yet accepted
     * - connected - the party is participating in the call
     * - declined - the party chose not to accept the call
     * - disconnected - the party is no longer participating in the call
     * - waiting - reserved for future use
     * @instance
     * @memberof CallMembership
     * @type {string}
     * @readonly
     */
    state: {
      required: true,
      type: 'string',
      values: [
        'notified',
        'connected',
        'declined',
        'disconnected',
        'waiting'
      ]
    },

    /**
     * Indicates if the member has muted their microphone
     * @instance
     * @memberof CallMembership
     * @type {boolean}
     * @readonly
     */
    audioMuted: {
      default: false,
      type: 'boolean'
    },

    /**
     * Indicates if the member has disable their camera
     * @instance
     * @memberof CallMembership
     * @type {boolean}
     * @readonly
     */
    videoMuted: {
      default: false,
      type: 'boolean'
    }
  }
});

export default CallMembership;
