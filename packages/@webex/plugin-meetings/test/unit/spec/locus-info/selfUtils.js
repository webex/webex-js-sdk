import {assert} from '@webex/test-helper-chai';
import Sinon from 'sinon';
import {cloneDeep} from 'lodash';
import SelfUtils from '@webex/plugin-meetings/src/locus-info/selfUtils';

import {self} from './selfConstant';

describe('plugin-meetings', () => {
  describe('selfUtils', () => {
    describe('layoutChanged', () => {
      it('should return true if the layout has changed', () => {
        const parsedSelf = SelfUtils.parse(self);
        const clonedSelf = cloneDeep(parsedSelf);

        clonedSelf.layout = 'DIFFERENT';

        assert.deepEqual(SelfUtils.layoutChanged(parsedSelf, clonedSelf), true);
      });

      it('should return false if the layout has not changed', () => {
        const parsedSelf = SelfUtils.parse(self);

        assert.deepEqual(SelfUtils.layoutChanged(parsedSelf, parsedSelf), false);
      });
    });

    describe('parse', () => {
      it('parse calls getRoles and returns the resulting roles', () => {
        const getRolesSpy = Sinon.spy(SelfUtils, 'getRoles');

        const parsedSelf = SelfUtils.parse(self);

        assert.calledWith(getRolesSpy, self);

        assert.deepEqual(parsedSelf.roles, ['PRESENTER']);
        assert.deepEqual(parsedSelf.breakoutSessions, {
          active: [
            {
              name: 'Breakout session 2',
              groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
              sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
              sessionType: 'BREAKOUT',
            },
          ],
          allowed: [
            {
              name: 'Breakout session 2',
              groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
              sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
              sessionType: 'BREAKOUT',
            },
          ],
        });
      });

      it('calls getLayout and returns the resulting layout', () => {
        const spy = Sinon.spy(SelfUtils, 'getLayout');
        const parsedSelf = SelfUtils.parse(self);

        assert.calledWith(spy, self);
        assert.deepEqual(parsedSelf.layout, self.controls.layouts[0].type);
      });
    });

    describe('getLayout', () => {
      it('should get supplied layout', () => {
        assert.deepEqual(SelfUtils.getLayout(self), self.controls.layouts[0].type);
      });

      it('should return undefined if the new self does not have a provided layout', () => {
        const mutatedSelf = cloneDeep(self);

        delete mutatedSelf.controls.layouts;

        assert.deepEqual(SelfUtils.getLayout(mutatedSelf), undefined);
      });
    });

    describe('getBreakoutSessions', () => {
      it('should return breakout sessions', () => {
        assert.deepEqual(
          SelfUtils.getBreakoutSessions({controls: {breakout: {sessions: 'SESSIONS'}}}),
          'SESSIONS'
        );
      });
    });

    describe('breakoutsChanged', () => {
      it('should return true if breakouts have changed', () => {
        const current = {
          breakoutSessions: {
            allowed: [
              {
                name: 'Breakout session 2',
                groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                sessionType: 'BREAKOUT',
              },
            ],
          },
          breakout: {},
        };
        const previous = {
          breakoutSessions: {
            active: [
              {
                name: 'Breakout session 2',
                groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                sessionType: 'BREAKOUT',
              },
            ],
          },
          breakout: {},
        };

        assert.isTrue(SelfUtils.breakoutsChanged(previous, current));
      });

      it('should return false if breakouts have not changed', () => {
        const current = {
          breakoutSessions: {
            active: [
              {
                name: 'Breakout session 2',
                groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                sessionType: 'BREAKOUT',
              },
            ],
          },
          breakout: {},
        };
        const previous = {
          breakoutSessions: {
            active: [
              {
                name: 'Breakout session 2',
                groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                sessionType: 'BREAKOUT',
              },
            ],
          },
          breakout: {},
        };

        assert.isFalse(SelfUtils.breakoutsChanged(previous, current));
      });

      it('should return false if no breakouts in current', () => {
        const current = {
          breakoutSessions: {},
        };
        const previous = {
          breakoutSessions: {
            active: [
              {
                name: 'Breakout session 2',
                groupId: '0e73abb8-5584-49d8-be8d-806d2a8247ca',
                sessionId: '1cf41ab1-2e57-4d95-b7e9-5613acddfb0f',
                sessionType: 'BREAKOUT',
              },
            ],
          },
          breakout: {},
        };

        assert.isFalse(SelfUtils.breakoutsChanged(previous, current));
      });
    });

    describe('canNotViewTheParticipantList', () => {
      it('should return the correct value', () => {
        assert.equal(
          SelfUtils.canNotViewTheParticipantList(self),
          self.canNotViewTheParticipantList
        );
      });

      it('should return false if the new self does not have a value', () => {
        const mutatedSelf = cloneDeep(self);

        delete mutatedSelf.canNotViewTheParticipantList;

        assert.equal(SelfUtils.canNotViewTheParticipantList(mutatedSelf), false);
      });
    });

    describe('isSharingBlocked', () => {
      it('should return the correct value', () => {
        assert.equal(SelfUtils.isSharingBlocked(self), self.isSharingBlocked);
      });

      it('should return false if the new self does not have a value', () => {
        const mutatedSelf = cloneDeep(self);

        delete mutatedSelf.isSharingBlocked;

        assert.equal(SelfUtils.isSharingBlocked(mutatedSelf), false);
      });
    });

    describe('getRoles', () => {
      it('get roles works', () => {
        assert.deepEqual(SelfUtils.getRoles(self), ['PRESENTER']);

        assert.deepEqual(
          SelfUtils.getRoles({
            controls: {
              role: {roles: [{type: 'SOME_ARBITRARY_ROLE', hasRole: true}]},
            },
          }),
          ['SOME_ARBITRARY_ROLE']
        );

        assert.deepEqual(
          SelfUtils.getRoles({
            controls: {
              role: {roles: [{type: 'SOME_ARBITRARY_ROLE', hasRole: false}]},
            },
          }),
          []
        );

        assert.deepEqual(SelfUtils.getRoles({}), []);
        assert.deepEqual(SelfUtils.getRoles(), []);
      });
    });

    describe('getSelves', () => {
      describe('canNotViewTheParticipantListChanged', () => {
        it('should return canNotViewTheParticipantListChanged = true when changed', () => {
          const clonedSelf = cloneDeep(self);

          clonedSelf.canNotViewTheParticipantList = true; // different

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.canNotViewTheParticipantListChanged, true);
        });

        it('should return canNotViewTheParticipantListChanged = false when unchanged', () => {
          const clonedSelf = cloneDeep(self);

          clonedSelf.canNotViewTheParticipantList = false; // same

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.canNotViewTheParticipantListChanged, false);
        });
      });

      describe('localAudioUnmuteRequestedByServer', () => {
        it('should return localAudioUnmuteRequestedByServer = false when requestedToUnmute = false', () => {
          const clonedSelf = cloneDeep(self);

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.localAudioUnmuteRequestedByServer, false);
        });

        it('should return localAudioUnmuteRequestedByServer = true when first request is made with requestedToUnmute = true', () => {
          const clonedSelf = cloneDeep(self);

          //request to unmute with timestamp
          clonedSelf.controls.audio.requestedToUnmute = true;
          clonedSelf.controls.audio.lastModifiedRequestedToUnmute = '2023-06-16T18:25:04.369Z';

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.localAudioUnmuteRequestedByServer, true);
        });

        it('should return localAudioUnmuteRequestedByServer = true when requestedToUnmute = true and new requests lastModifiedRequestedToUnmute timestamp is greater than old one', () => {
          self.controls.audio.requestedToUnmute = true;
          self.controls.audio.lastModifiedRequestedToUnmute = '2023-06-16T18:25:04.369Z';
          const clonedSelf = cloneDeep(self);

          //request to unmute with timestamp
          clonedSelf.controls.audio.requestedToUnmute = true;
          clonedSelf.controls.audio.lastModifiedRequestedToUnmute = '2023-06-16T19:25:04.369Z';

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.localAudioUnmuteRequestedByServer, true);
        });

        it('should return localAudioUnmuteRequestedByServer = false when requestedToUnmute but lastModifiedRequestedToUnmute timestamps are same', () => {
          self.controls.audio.requestedToUnmute = true;
          self.controls.audio.lastModifiedRequestedToUnmute = '2023-06-16T18:25:04.369Z';
          const clonedSelf = cloneDeep(self);

          clonedSelf.controls.audio.requestedToUnmute = true;
          clonedSelf.controls.audio.lastModifiedRequestedToUnmute = '2023-06-16T18:25:04.369Z';

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.localAudioUnmuteRequestedByServer, false);
        });
      });
    });

    describe('isSharingBlocked', () => {
      it('should return isSharingBlockedChanged = true when changed', () => {
        const clonedSelf = cloneDeep(self);

        clonedSelf.isSharingBlocked = true; // different

        const {updates} = SelfUtils.getSelves(self, clonedSelf);

        assert.equal(updates.isSharingBlockedChanged, true);
      });

      it('should return isSharingBlockedChanged = false when unchanged', () => {
        const clonedSelf = cloneDeep(self);

        clonedSelf.isSharingBlocked = false; // same

        const {updates} = SelfUtils.getSelves(self, clonedSelf);

        assert.equal(updates.isSharingBlockedChanged, false);
      });
    });
  });

  describe('isJoined', () => {
    it(' returns true if state is joined', () => {
      assert.deepEqual(SelfUtils.isJoined(self), true);
    });

    it(' returns true if state is not joined', () => {
      const customSelf = {...self, state: 'NOT_JOINED'};

      assert.deepEqual(SelfUtils.isJoined(customSelf), false);
    });

    it(' returns true if state is empty', () => {
      const customSelf = {...self};

      delete customSelf.state;

      assert.deepEqual(SelfUtils.isJoined(customSelf), false);
    });
  });

  describe('mutedByOthersChanged', () => {
    it('throws an error if changedSelf is not provided', function () {
      assert.throws(
        () => SelfUtils.mutedByOthersChanged({}, null),
        'New self must be defined to determine if self was muted by others.'
      );
    });

    it('return false when oldSelf is not defined', function () {
      assert.equal(SelfUtils.mutedByOthersChanged(null, {remoteMuted: false}), false);
    });

    it('should return true when remoteMuted is true on entry', function () {
      assert.equal(SelfUtils.mutedByOthersChanged(null, {remoteMuted: true}), true);
    });

    it('should return true when remoteMuted values are different', function () {
      assert.equal(
        SelfUtils.mutedByOthersChanged(
          {remoteMuted: false},
          {remoteMuted: true, selfIdentity: 'user1', modifiedBy: 'user2'}
        ),
        true
      );
    });

    it('should return true when remoteMuted is true and unmuteAllowed has changed', function () {
      assert.equal(
        SelfUtils.mutedByOthersChanged(
          {remoteMuted: true, unmuteAllowed: false},
          {remoteMuted: true, unmuteAllowed: true, selfIdentity: 'user1', modifiedBy: 'user2'}
        ),
        true
      );
    });
  });

  describe('videoMutedByOthersChanged', () => {
    it('returns true if changed', () => {
      assert.equal(
        SelfUtils.videoMutedByOthersChanged({remoteVideoMuted: true}, {remoteVideoMuted: false}),
        true
      );
    });

    it('returns true if changed from undefined', () => {
      assert.equal(SelfUtils.videoMutedByOthersChanged({}, {remoteVideoMuted: false}), true);
    });

    it('returns false if not changed', () => {
      assert.equal(
        SelfUtils.videoMutedByOthersChanged({remoteVideoMuted: false}, {remoteVideoMuted: false}),
        false
      );
    });
  });

  describe('getReplacedBreakoutMoveId', () => {
    const deviceId = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/20eabde3-4254-48da-9a24';
    const breakoutMoveId = 'e5caeb2c-ffcc-4e06-a08a-1122e7710398';
    const clonedSelf = cloneDeep(self);

    it('get breakoutMoveId works', () => {
      assert.deepEqual(SelfUtils.getReplacedBreakoutMoveId(self, deviceId), breakoutMoveId);
    });

    it('replaces is empty', () => {
      clonedSelf.devices[0].replaces = undefined;
      assert.deepEqual(SelfUtils.getReplacedBreakoutMoveId(clonedSelf, deviceId), null);
    });

    it('no self or self.devices is not array', () => {
      assert.deepEqual(SelfUtils.getReplacedBreakoutMoveId(undefined, deviceId), null);

      clonedSelf.devices = {
        url: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/20eabde3-4254-48da-9a24',
        deviceType: 'WEB',
        mediaSessionsExternal: false,
        replaces: [
          {
            breakoutMoveId: 'e5caeb2c-ffcc-4e06-a08a-1122e7710398',
            lastActive: '2023-05-04T07:14:32.068Z',
            locusUrl:
              'https://locus-alpha-apdx.prod.meetapi.webex.com/locus/api/v1/loci/495061ca-7b3c-3b77-85ff-4e1bd58600d1',
            replacedAt: '2023-05-04T07:16:04.905Z',
            sessionId: 'be3147d4-c318-86d8-7611-8d24beaaca8d',
          },
        ],
        state: 'JOINED',
      };
      assert.deepEqual(SelfUtils.getReplacedBreakoutMoveId(clonedSelf, deviceId), null);
    });
  });

  describe('isRolesChanged', () => {
    it('should return false if new self is null', () => {
      const parsedSelf = SelfUtils.parse(self);

      assert.deepEqual(SelfUtils.isRolesChanged(parsedSelf, null), false);
    });

    it('should return true if self roles has changed', () => {
      const parsedSelf = SelfUtils.parse(self);
      const clonedSelf = cloneDeep(parsedSelf);

      clonedSelf.roles = ['COHOST'];

      assert.deepEqual(SelfUtils.isRolesChanged(parsedSelf, clonedSelf), true);
    });

    it('should return false if self roles has not changed', () => {
      const parsedSelf = SelfUtils.parse(self);
      const clonedSelf = cloneDeep(parsedSelf);

      clonedSelf.roles = ['PRESENTER'];

      assert.deepEqual(SelfUtils.isRolesChanged(parsedSelf, clonedSelf), false);
    });
  });

  describe('interpretationChanged', () => {
    it('should return false if new self is null', () => {
      const parsedSelf = SelfUtils.parse(self);

      assert.deepEqual(SelfUtils.interpretationChanged(parsedSelf, null), false);
    });

    it('should return true if interpretation info has changed', () => {
      const parsedSelf = SelfUtils.parse(self);
      const clonedSelf = cloneDeep(parsedSelf);

      clonedSelf.interpretation.sourceLanguage = 'ja';

      assert.deepEqual(SelfUtils.interpretationChanged(parsedSelf, clonedSelf), true);
    });

    it('should return false if interpretation info  has not changed', () => {
      const parsedSelf = SelfUtils.parse(self);
      const clonedSelf = cloneDeep(parsedSelf);

      clonedSelf.interpretation.sourceLanguage = 'en';

      assert.deepEqual(SelfUtils.interpretationChanged(parsedSelf, clonedSelf), false);
    });
  });
});
