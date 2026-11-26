const {getUnconfirmedChannelTypes} = require('../../../../../../docs/samples/contact-center/wellness-utils');

describe('contact-center wellness sample utilities', () => {
  describe('getUnconfirmedChannelTypes', () => {
    it('accepts a matching pending Idle confirmation while the task is still active', () => {
      const unconfirmed = getUnconfirmedChannelTypes(
        {
          chat: {
            agentState: 'Engaged',
            auxCodeId: 'wellness-code',
            pendingIdle: true,
          },
        },
        ['chat'],
        'Idle',
        'wellness-code'
      );

      expect(unconfirmed).toEqual([]);
    });

    it('keeps a channel unconfirmed when pending Idle does not match the requested code', () => {
      const unconfirmed = getUnconfirmedChannelTypes(
        {
          chat: {
            agentState: 'Engaged',
            auxCodeId: 'other-code',
            pendingIdle: true,
          },
        },
        ['chat'],
        'Idle',
        'wellness-code'
      );

      expect(unconfirmed).toEqual(['chat']);
    });
  });
});
