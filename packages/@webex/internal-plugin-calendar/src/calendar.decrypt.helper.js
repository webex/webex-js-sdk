const _decryptTextProp = (ctx, name, key, object) => {
  if (!object[name]) {
    return Promise.resolve();
  }

  return ctx.webex.internal.encryption
    .decryptText(key.uri || key, object[name])
    .then((plaintext) => {
      object[name] = plaintext;
    });
};

const DecryptHelper = {
  /**
   * Decrypt scheduler data response
   * @param {object} [ctx] context
   * @param {object} [data] scheduler data response
   * @returns {Promise} Resolves with decrypted response
   * */
  decryptSchedulerDataResponse: (ctx, data) => {
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
            _decryptTextProp(ctx, 'encryptedEmailAddress', data.encryptionKeyUrl, participant),
            _decryptTextProp(ctx, 'encryptedName', data.encryptionKeyUrl, participant),
          ])
        )
      : [];

    // Decrypt encryptedScheduleFor properties if meeting object contains SOB
    const decryptedScheduleFor = Promise.all(
      Object.values(data.encryptedScheduleFor || {}).flatMap((item) => [
        _decryptTextProp(ctx, 'encryptedEmail', data.encryptionKeyUrl, item),
        _decryptTextProp(ctx, 'encryptedDisplayName', data.encryptionKeyUrl, item),
      ])
    );

    // Decrypt meetingJoinInfo properties if meeting object contains meetingJoinInfo
    const decryptedMeetingJoinInfo = data.meetingJoinInfo
      ? Promise.all([
          _decryptTextProp(ctx, 'meetingJoinURI', data.encryptionKeyUrl, data.meetingJoinInfo),
          _decryptTextProp(ctx, 'meetingJoinURL', data.encryptionKeyUrl, data.meetingJoinInfo),
        ])
      : [];

    const decryptedOrganizer = data.encryptedOrganizer
      ? Promise.all([
          _decryptTextProp(
            ctx,
            'encryptedEmailAddress',
            data.encryptionKeyUrl,
            data.encryptedOrganizer
          ),
          _decryptTextProp(ctx, 'encryptedName', data.encryptionKeyUrl, data.encryptedOrganizer),
        ])
      : [];

    return Promise.all(
      [
        _decryptTextProp(ctx, 'encryptedSubject', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'encryptedLocation', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'encryptedNotes', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'webexURI', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'webexURL', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'spaceMeetURL', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'spaceURI', data.encryptionKeyUrl, data),
        _decryptTextProp(ctx, 'spaceURL', data.encryptionKeyUrl, data),
      ].concat(
        decryptedOrganizer,
        decryptedParticipants,
        decryptedScheduleFor,
        decryptedMeetingJoinInfo
      )
    );
  },
  /**
   * Decrypt free-busy response
   * @param {object} [ctx] context
   * @param {object} [data] free-busy response
   * @returns {Promise} Resolves with decrypted response
   * */
  decryptFreeBusyResponse: (ctx, data) => {
    if (!data) {
      return Promise.resolve();
    }

    if (!data.calendarFreeBusyScheduleResponse) {
      return Promise.resolve();
    }

    if (!data.calendarFreeBusyScheduleResponse.encryptionKeyUrl) {
      return Promise.resolve();
    }

    const calendarFreeBusyItems = data.calendarFreeBusyScheduleResponse.calendarFreeBusyItems
      ? data.calendarFreeBusyScheduleResponse.calendarFreeBusyItems.map((calendarFreeBusyItem) =>
          Promise.all([
            _decryptTextProp(
              ctx,
              'email',
              data.calendarFreeBusyScheduleResponse.encryptionKeyUrl,
              calendarFreeBusyItem
            ),
          ])
        )
      : [];

    return Promise.all([].concat(calendarFreeBusyItems));
  },
};

export default DecryptHelper;
