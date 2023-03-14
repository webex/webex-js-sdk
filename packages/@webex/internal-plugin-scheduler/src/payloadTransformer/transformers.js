/**
 * Transformers are used to process data from requests and events, performing
 * actions prior to the resolution of a `request` or `event` within the calling
 * stack.
 */
const transformSchedulerData = {
  /**
   * Name of this transformer.
   *
   * The usage of this transformer can be validated via a predicate. See the
   * `predicates.js` file for more details.
   *
   * @type {string}
   */
  name: 'transformSchedulerData',

  /**
   * Direction this transformer should process on. This allows for different
   * directions to be handled differently when sending/receiving data.
   *
   * @type {'inbound' | 'outbound' | undefined}
   */
  direction: 'inbound',

  /**
   * The main transformation function
   * @param {Record<'webex' | 'transform', any>} ctx - An Object containing a webex instance and transform prop.
   * @param {any} data - Data from the event or request.
   * @returns {Promise<any>} - Data after transformation.
   */
  fn: (ctx, data) => {
    if (!data) {
      return Promise.resolve();
    }

    if (!data.encryptionKeyUrl) {
      return Promise.resolve();
    }

    // Decrypt participant properties if meeting object contains participants
    const decryptedParticipants = data.encryptedParticipants
      ? data.encryptedParticipants.map((participant) =>
          Promise.all([
            ctx.transform(
              'decryptTextProp',
              'encryptedEmailAddress',
              data.encryptionKeyUrl,
              participant
            ),
            ctx.transform('decryptTextProp', 'encryptedName', data.encryptionKeyUrl, participant),
          ])
        )
      : [];

    // Decrypt meetingJoinInfo properties if meeting object contains meetingJoinInfo
    const decryptedMeetingJoinInfo = data.meetingJoinInfo
      ? Promise.all([
          ctx.transform(
            'decryptTextProp',
            'meetingJoinURI',
            data.encryptionKeyUrl,
            data.meetingJoinInfo
          ),
          ctx.transform(
            'decryptTextProp',
            'meetingJoinURL',
            data.encryptionKeyUrl,
            data.meetingJoinInfo
          ),
        ])
      : [];

    const decryptedOrganizer = data.encryptedOrganizer
      ? Promise.all([
          ctx.transform(
            'decryptTextProp',
            'encryptedEmailAddress',
            data.encryptionKeyUrl,
            data.encryptedOrganizer
          ),
          ctx.transform(
            'decryptTextProp',
            'encryptedName',
            data.encryptionKeyUrl,
            data.encryptedOrganizer
          ),
        ])
      : [];

    return Promise.all(
      [
        ctx.transform('decryptTextProp', 'encryptedSubject', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'encryptedLocation', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'encryptedNotes', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'webexURI', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'webexURL', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'spaceMeetURL', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'spaceURI', data.encryptionKeyUrl, data),
        ctx.transform('decryptTextProp', 'spaceURL', data.encryptionKeyUrl, data),
      ].concat(decryptedOrganizer, decryptedParticipants, decryptedMeetingJoinInfo)
    );
  },
};

const transformSchedulerRequest = {
  name: 'transformSchedulerRequest',
  direction: 'outbound',
  fn: (ctx, data) => {
    return ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then((keys) => {
      const key = keys[0];

      Object.assign(data, {encryptionKeyUrl: key.uri});

      const encryptedAttendees = data.attendees
        ? data.attendees.map((attendee) =>
            Promise.all([
              ctx.transform('encryptTextProp', 'displayName', data.encryptionKeyUrl, attendee),
              ctx.transform('encryptTextProp', 'email', data.encryptionKeyUrl, attendee),
            ])
          )
        : [];

      return Promise.all(
        [
          ctx.transform('encryptTextProp', 'subject', data.encryptionKeyUrl, data),
          ctx.transform('encryptTextProp', 'notes', data.encryptionKeyUrl, data),
          ctx.transform('encryptTextProp', 'webexOptions', data.encryptionKeyUrl, data),
        ].concat(encryptedAttendees)
      );
    });
  },
};

const transformFreeBusyRequest = {
  name: 'transformFreeBusyRequest',
  direction: 'outbound',
  fn: (ctx, data) => {
    return ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then((keys) => {
      const key = keys[0];

      Object.assign(data, {encryptionKeyUrl: key.uri});

      const promises = [];
      if (data.emails && Array.isArray(data.emails)) {
        data.emails.map((item, index) =>
          promises.push(
            ctx.webex.internal.encryption
              .encryptText(data.encryptionKeyUrl, item)
              .then((encryptText) => {
                data.emails[index] = encryptText;
              })
          )
        );
      }

      return Promise.all(promises);
    });
  },
};

const transformFreeBusyResponse = {
  name: 'transformFreeBusyResponse',
  direction: 'inbound',
  fn: (ctx, data) => {
    if (!data) {
      return Promise.resolve();
    }

    if (!data.encryptionKeyUrl) {
      return Promise.resolve();
    }

    const calendarFreeBusyItems = data.calendarFreeBusyItems
      ? data.calendarFreeBusyItems.map((calendarFreeBusyItem) =>
          Promise.all([
            ctx.transform('decryptTextProp', 'email', data.encryptionKeyUrl, calendarFreeBusyItem),
          ])
        )
      : [];

    return Promise.all([].concat(calendarFreeBusyItems));
  },
};

const transformers = {
  transformSchedulerData,
  transformSchedulerRequest,
  transformFreeBusyRequest,
  transformFreeBusyResponse,
};

export default transformers;
