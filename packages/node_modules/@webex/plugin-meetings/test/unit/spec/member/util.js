import {assert} from '@webex/test-helper-chai';

import MemberUtil from '@webex/plugin-meetings/src/member/util';


describe('isHandRaised', () => {
  it('throws error when there is no participant', () => {
    assert.throws(() => {
      MemberUtil.isHandRaised();
    }, 'Raise hand could not be processed, participant is undefined.');
  });

  it('returns false when controls is not there', () => {
    const participant = {};

    assert.isFalse(MemberUtil.isHandRaised(participant));
  });

  it('returns false when hand is not there in controls', () => {
    const participant = {
      controls: {}
    };

    assert.isFalse(MemberUtil.isHandRaised(participant));
  });

  it('returns true when hand raised is true', () => {
    const participant = {
      controls: {
        hand: {
          raised: true
        },
      }
    };

    assert.isTrue(MemberUtil.isHandRaised(participant));
  });

  it('returns false when hand raised is false', () => {
    const participant = {
      controls: {
        hand: {
          raised: false
        },
      }
    };

    assert.isFalse(MemberUtil.isHandRaised(participant));
  });
});
