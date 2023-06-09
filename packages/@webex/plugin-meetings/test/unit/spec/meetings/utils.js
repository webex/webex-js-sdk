import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import MeetingsUtil from '@webex/plugin-meetings/src/meetings/util';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';

describe('plugin-meetings', () => {
  beforeEach(() => {
    sinon.stub(Metrics, 'sendBehavioralMetric');
  });
  afterEach(() => {
    sinon.restore();
  });
  describe('Meetings utils function', () => {
    describe('#parseDefaultSiteFromMeetingPreferences', () => {
      it('should return the default true site from user preferences', () => {
        const userPreferences = {
          sites: [
            {
              siteUrl: 'site1-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'site2-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'go.webex.com',
              default: true,
            },
            {
              siteUrl: 'site3-example.webex.com',
              default: false,
            },
          ],
        };

        assert.equal(
          MeetingsUtil.parseDefaultSiteFromMeetingPreferences(userPreferences),
          'go.webex.com'
        );
      });

      it('should take the first site if none are default', () => {
        const userPreferences = {
          sites: [
            {
              siteUrl: 'site1-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'site2-example.webex.com',
              default: false,
            },
            {
              siteUrl: 'site3-example.webex.com',
              default: false,
            },
          ],
        };

        assert.equal(
          MeetingsUtil.parseDefaultSiteFromMeetingPreferences(userPreferences),
          'site1-example.webex.com'
        );
      });

      it('should work fine if sites an empty array', () => {
        const userPreferences = {
          sites: [],
        };

        assert.equal(MeetingsUtil.parseDefaultSiteFromMeetingPreferences(userPreferences), '');
      });
    });

    describe('#getThisDevice', () => {
      it('return null if no devices in self', () => {
        const newLocus = {};
        assert.equal(MeetingsUtil.getThisDevice(newLocus, '123'), null);
      });
      it('return null if no matched device in self', () => {
        const newLocus = {
          self: {
            devices: [{state: 'JOINED', url: '456'}]
          }
        };
        assert.equal(MeetingsUtil.getThisDevice(newLocus, '123'), null);
      });
      it('return the device match with current device', () => {
        const newLocus = {
          self: {
            devices: [{state: 'JOINED', url: '123'}]
          }
        };
        assert.deepEqual(MeetingsUtil.getThisDevice(newLocus, '123'), {state: 'JOINED', url: '123'});
      })
    });

    describe('#isBreakoutLocusDTO', () => {
      it('returns false is no breakout in locus.controls', () => {
        const newLocus = {
          controls: {}
        };

        assert.equal(MeetingsUtil.isBreakoutLocusDTO(newLocus), false);
      });

      it('returns is breakout locus DTO if sessionType is BREAKOUT', () => {
        const newLocus = {
          controls: {
            breakout: {
              sessionType: 'BREAKOUT',
            },
          },
        };
        assert.equal(MeetingsUtil.isBreakoutLocusDTO(newLocus), true);
      });

      it('returns is not breakout locus DTO if sessionType is MAIN', () => {
        const newLocus = {
          controls: {
            breakout: {
              sessionType: 'MAIN',
            },
          },
        };
        assert.equal(MeetingsUtil.isBreakoutLocusDTO(newLocus), false);
      });
    });

    describe('#joinedOnThisDevice', () => {
      it('return false if no devices in self', () => {
        const newLocus = {};
        assert.equal(MeetingsUtil.joinedOnThisDevice(null, newLocus, '123'), false);
      });
      it('return true if joined on this device', () => {
        const newLocus = {
          self: {
            devices: [{state: 'JOINED', correlationId: '111', url: '123'}]
          }
        };
        const meeting = {
          correlationId: '111'
        };

        assert.equal(MeetingsUtil.joinedOnThisDevice(meeting, newLocus, '123'), true);
      });
      it('return true if selfMoved on this device', () => {
        const newLocus = {
          self: {
            devices: [{state: 'LEFT', reason: 'MOVED', correlationId: '111', url: '123'}]
          }
        };
        const meeting = {
          correlationId: '111'
        };

        assert.equal(MeetingsUtil.joinedOnThisDevice(meeting, newLocus, '123'), true);
      });
    });

    describe("#handleRoapMercury", () => {
      it('it sends the correct behaviour metric', () => {
        const roapMessageReceived = sinon.stub();
        const envelope = {
          data: {
            message:{
              seq: "seq",
              messageType: 'messageType',
              tieBreaker: 'tieBreaker',
              errorType: 'errorType',
              errorCause: 'errorCause',
              sdps: [{id:'sdp-1'}]
            },
            correlationId: 'correlationId',
            eventType: 'locus.message.roap',
          }
        };
        const meetingCollection = {
          getByKey: () => ({
            id: 'meeting-id',
            mediaProperties: {
              webrtcMediaConnection: {
                roapMessageReceived
              }
            }
          })
        };

        MeetingsUtil.handleRoapMercury(envelope, meetingCollection);
        assert.calledWith(Metrics.sendBehavioralMetric, BEHAVIORAL_METRICS.ROAP_MERCURY_EVENT_RECEIVED,  {
          correlation_id: 'correlationId',
          seq: "seq",
          message_type: 'messageType',
          tie_breaker: 'tieBreaker',
          error_type: 'errorType',
          error_cause: 'errorCause',
          sdp: { id: 'sdp-1' }
        })
        assert.calledWith(roapMessageReceived, {
          seq: "seq",
          messageType: 'messageType',
          tieBreaker: 'tieBreaker',
          errorType: 'errorType',
          errorCause: 'errorCause',
          sdp: {id:'sdp-1'}
        })

      });
    })
  });

  describe('#isValidBreakoutLocus', () => {
    it('returns false if is not breakout locus', () => {
      const newLocus = {
        controls: {}
      };

      assert.equal(MeetingsUtil.isValidBreakoutLocus(newLocus), false);
    });

    it('returns false if fullState is inactive', () => {
      const newLocus = {
        controls: {
          breakout: {
            sessionType: 'BREAKOUT',
          },
        },
        fullState: {
          state: 'INACTIVE'
        }
      };
      assert.equal(MeetingsUtil.isValidBreakoutLocus(newLocus), false);
    });

    it('returns false if self is not joined', () => {
      const newLocus = {
        controls: {
          breakout: {
            sessionType: 'BREAKOUT',
          },
        },
        fullState: {
          state: 'ACTIVE'
        },
        self: {
          state: 'LEFT'
        }
      };
      assert.equal(MeetingsUtil.isValidBreakoutLocus(newLocus), false);
    });

    it('returns true if self is JOINED and fullState is active', () => {
      const newLocus = {
        controls: {
          breakout: {
            sessionType: 'BREAKOUT',
          },
        },
        fullState: {
          state: 'ACTIVE'
        },
        self: {
          state: 'JOINED'
        }
      };
      assert.equal(MeetingsUtil.isValidBreakoutLocus(newLocus), true);
    });
  });
});
