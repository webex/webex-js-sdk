/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import 'jsdom-global/register';
import sinon from 'sinon';
import uuid from 'uuid';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {Credentials} from '@webex/webex-core';
import Support from '@webex/internal-plugin-support';
import MockWebex from '@webex/test-helper-mock-webex';
import ParameterError from '@webex/plugin-meetings/src/common/errors/parameter';
import Meetings from '@webex/plugin-meetings';
import Members from '@webex/plugin-meetings/src/members';
import MembersUtil from '@webex/plugin-meetings/src/members/util';
import * as MembersRequestImport from '@webex/plugin-meetings/src/members/request';
import Trigger from '@webex/plugin-meetings/src/common/events/trigger-proxy';
import {EVENT_TRIGGERS} from '@webex/plugin-meetings/src/constants';
import {
  ReclaimHostEmptyWrongKeyError,
  ReclaimHostIsHostAlreadyError,
  ReclaimHostNotAllowedError,
  ReclaimHostNotSupportedError,
} from '../../../../src/common/errors/reclaim-host-role-errors';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  let webex;
  let url1;
  const fakeMembersCollection = {
    test1: {
      namespace: 'Meetings',
      participant: {
        state: 'JOINED',
        type: 'USER',
        person: {
          id: '6eb08f8b-bf69-3251-a126-b161bead2d21',
          phoneNumber: '+18578675309',
          isExternal: true,
          primaryDisplayString: '+18578675309',
        },
        devices: [
          {
            url: 'https://fakeURL.com',
            deviceType: 'SIP',
            state: 'JOINED',
            intents: [null],
            correlationId: '1234',
            provisionalUrl: 'dialout:///fake',
            isSparkPstn: true,
          },
          {
            url: 'dialout:///fakeagain',
            deviceType: 'PROVISIONAL',
            state: 'JOINED',
            intents: [null],
            correlationId: '4321',
            isVideoCallback: false,
            clientUrl: 'https://fakeURL',
            provisionalType: 'DIAL_OUT_ONLY',
            dialingStatus: 'SUCCESS',
          },
        ],
        status: {
          audioStatus: 'SENDRECV',
          videoStatus: 'INACTIVE',
        },
        id: 'abc-123-abc-123',
        guest: true,
        resourceGuest: false,
        moderator: false,
        panelist: false,
        moveToLobbyNotAllowed: true,
        deviceUrl: 'https://fakeDeviceurl',
      },
      id: 'abc-123-abc-123',
      status: 'IN_MEETING',
      type: 'MEETING',
      isModerator: false,
    },
  };

  describe('members', () => {
    const sandbox = sinon.createSandbox();
    let createMembers;
    let meeting;
    let membersRequestSpy;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          meetings: Meetings,
          credentials: Credentials,
          support: Support,
        },
        config: {
          credentials: {
            client_id: 'mock-client-id',
          },
          meetings: {
            reconnection: {
              enabled: false,
            },
            mediaSettings: {},
            metrics: {},
            stats: {},
          },
        },
      });

      url1 = `https://example.com/${uuid.v4()}`;

      membersRequestSpy = sinon.spy(MembersRequestImport, 'default');

      meeting = {
        request: sinon.mock().returns(Promise.resolve()),
        locusInfo: {
          sequence: {}
        }
      }

      createMembers = (options) => new Members({locusUrl: options.url, meeting}, {parent: webex});
    });

    afterEach(() => {
      membersRequestSpy.restore();
      sandbox.restore();
    });

    describe('constructor', () => {
      it('passes the meeting to the MembersRequest', () => {
        createMembers({});

        assert.calledOnceWithExactly(membersRequestSpy, {meeting}, {parent: webex});
      });
    });

    describe('#addMembers', () => {
      it('should invoke isInvalidInvitee and generateAddMemberOptions from MembersUtil when addMember is called with valid params', async () => {
        sandbox.spy(MembersUtil, 'isInvalidInvitee');
        sandbox.spy(MembersUtil, 'generateAddMemberOptions');

        const members = createMembers({url: url1});

        await members.addMember({phoneNumber: '+18578675309'});
        assert.calledOnce(MembersUtil.isInvalidInvitee);
        assert.calledOnce(MembersUtil.generateAddMemberOptions);
      });

      it('should throw a rejection if there is no locus url', async () => {
        const members = createMembers({url: false});

        assert.isRejected(members.addMember({email: 'test@cisco.com'}));
      });
    });

    describe('#admitMembers', () => {
      let members;
      beforeEach(() => {
        members = createMembers({url: url1});
        members.membersRequest.admitMember = sinon.stub().returns(Promise.resolve(true));
      });
      it('should return error if param memberIds is not provided', async () => {
        let error;
        await members.admitMembers().catch((e) => {
          error = e;
        });
        assert.deepEqual(error, new ParameterError('No member ids provided to admit.'));
      });

      it('should call membersRequest.admitMember as expected', async () => {
        await members.admitMembers(['uuid']);
        const arg1 = members.membersRequest.admitMember.getCall(0).args[0];
        assert.equal(arg1.sessionLocusUrls, undefined);
        assert.equal(arg1.locusUrl.includes('https://example.com/'), true);
        assert.deepEqual(arg1.memberIds, ['uuid']);

        const sessionLocusUrls = {
          authorizingLocusUrl: 'authorizingLocusUrl',
          mainLocusUrl: 'mainLocusUrl',
        };
        await members.admitMembers(['uuid'], sessionLocusUrls);
        const arg2 = members.membersRequest.admitMember.getCall(1).args[0];
        assert.equal(arg2.sessionLocusUrls, sessionLocusUrls);
        assert.equal(arg1.locusUrl.includes('https://example.com/'), true);
        assert.deepEqual(arg1.memberIds, ['uuid']);
      });
    });

    describe('#muteMember', () => {
      const testMuteMember = async (mute, isAudio) => {
        sandbox.spy(MembersUtil, 'generateMuteMemberOptions');

        const locusUrl = 'locus-url';
        const members = createMembers({url: locusUrl});
        const {membersRequest} = members;
        sandbox.spy(membersRequest, 'muteMember');

        const memberId = 'bob';

        await members.muteMember(memberId, mute, isAudio);
        assert.calledOnce(MembersUtil.generateMuteMemberOptions);
        assert.calledWith(
          MembersUtil.generateMuteMemberOptions,
          memberId,
          mute,
          members.locusUrl,
          isAudio
        );

        assert.calledOnce(membersRequest.muteMember);
        assert.calledWith(membersRequest.muteMember, {memberId, muted: mute, locusUrl, isAudio});
      };

      it('invokes expected functions when muteMember is called for mute=true, isAudio=true', async () => {
        testMuteMember(true, true);
      });

      it('invokes expected functions when muteMember is called for mute=true, isAudio=false', async () => {
        testMuteMember(true, false);
      });

      it('invokes expected functions when muteMember is called for mute=false, isAudio=true', async () => {
        testMuteMember(false, true);
      });

      it('invokes expected functions when muteMember is called for mute=false, isAudio=false', async () => {
        testMuteMember(false, false);
      });
    });

    describe('#clearMembers', () => {
      it('should send clear event if clear members', () => {
        const members = createMembers({url: url1});
        members.membersCollection.setAll(fakeMembersCollection);
        sinon.stub(Trigger, 'trigger');
        members.clearMembers();
        assert.deepEqual(members.membersCollection.members, {});
        assert.calledWith(
          Trigger.trigger,
          members,
          {
            file: 'members',
            function: 'clearMembers',
          },
          EVENT_TRIGGERS.MEMBERS_CLEAR,
          {}
        );
      });
    });
    describe('#locusParticipantsUpdate', () => {
      it('should send member update event with session info', () => {
        const members = createMembers({url: url1});
        const fakePayload = {
          participants: {
            forEach: sinon.stub(),
          },
          isReplace: true,
        };

        members.locusParticipantsUpdate(fakePayload);

        assert.calledWith(
          Trigger.trigger,
          members,
          {
            file: 'members',
            function: 'locusParticipantsUpdate',
          },
          EVENT_TRIGGERS.MEMBERS_UPDATE,
          {
            delta: {added: [], updated: []},
            full: {},
            isReplace: true,
          }
        );
      });
    });
    describe('#sendDialPadKey', () => {
      it('should throw a rejection when calling sendDialPadKey with no tones', async () => {
        const members = createMembers({url: url1});

        assert.isRejected(members.sendDialPadKey());
      });

      it('should throw a rejection when calling sendDialPadKey with no member is found', async () => {
        const members = createMembers({url: url1});

        assert.isRejected(members.sendDialPadKey('1', '1234'));
      });

      it('should call genderateSendDTMFOptions with proper options on Members util if we the member is valid', async () => {
        sandbox.spy(MembersUtil, 'genderateSendDTMFOptions');
        const members = createMembers({url: url1});

        members.membersCollection.setAll(fakeMembersCollection);
        await members.sendDialPadKey('1', 'test1');
        assert.calledWith(
          MembersUtil.genderateSendDTMFOptions,
          'https://fakeURL.com',
          '1',
          'test1',
          url1
        );
      });

      it('should call the sendDialPadKey method on membersRequest if the member is valid', async () => {
        const members = createMembers({url: url1});

        const {membersRequest} = members;

        assert.exists(membersRequest);
        const sendDialPadKeyspy = sandbox.spy(membersRequest, 'sendDialPadKey');

        members.membersCollection.setAll(fakeMembersCollection);
        await members.sendDialPadKey('1', 'test1');
        assert.calledOnce(sendDialPadKeyspy);
      });
    });

    describe('#cancelPhoneInvite', () => {
      it('should invoke isInvalidInvitee and generateAddMemberOptions from MembersUtil when addMember is called with valid params', async () => {
        sandbox.spy(MembersUtil, 'isInvalidInvitee');
        sandbox.spy(MembersUtil, 'cancelPhoneInviteOptions');

        const members = createMembers({url: url1});

        await members.cancelPhoneInvite({phoneNumber: '+18578675309'});
        assert.calledOnce(MembersUtil.isInvalidInvitee);
        assert.calledOnce(MembersUtil.cancelPhoneInviteOptions);
      });

      it('should throw a rejection if there is no locus url', async () => {
        const members = createMembers({url: false});

        assert.isRejected(members.cancelPhoneInvite({phoneNumber: '+18578675309'}));
      });
    });

    describe('#assignRoles', () => {
      const fakeRoles = [
        {type: 'PRESENTER', hasRole: true},
        {type: 'MODERATOR', hasRole: false},
        {type: 'COHOST', hasRole: true},
      ];

      const resolvedValue = "it worked";

      const genericMessage = 'Generic error from the API';

      const setup = (locusUrl, errorCode) => {
        const members = createMembers({url: locusUrl});

        const spies = {
          generateRoleAssignmentMemberOptions: sandbox.spy(
            MembersUtil,
            'generateRoleAssignmentMemberOptions'
          ),
        };

        if (errorCode) {
          spies.assignRolesMember = sandbox.stub(members.membersRequest, 'assignRolesMember').rejects({body: {errorCode}, message: genericMessage});
        } else {
          spies.assignRolesMember = sandbox.stub(members.membersRequest, 'assignRolesMember').resolves(resolvedValue);
        }

        return {members, spies};
      };

      const checkInvalid = async (resultPromise, expectedMessage, spies) => {
        await assert.isRejected(resultPromise, ParameterError, expectedMessage);
        assert.notCalled(spies.generateRoleAssignmentMemberOptions);
        assert.notCalled(spies.assignRolesMember);
      };

      const checkError = async (error, expectedMemberId, expectedRoles, expectedLocusUrl, resultPromise, expectedMessage, spies) => {
        await assert.isRejected(resultPromise, error, expectedMessage);
        assert.calledOnceWithExactly(
          spies.generateRoleAssignmentMemberOptions,
          expectedMemberId,
          expectedRoles,
          expectedLocusUrl
        );
        assert.calledOnceWithExactly(spies.assignRolesMember, {
          memberId: expectedMemberId,
          roles: expectedRoles,
          locusUrl: expectedLocusUrl,
        });
      };

      const checkValid = async (
        resultPromise,
        spies,
        expectedMemberId,
        expectedRoles,
        expectedLocusUrl
      ) => {
        const resolvedValue = await assert.isFulfilled(resultPromise);
        assert.calledOnceWithExactly(
          spies.generateRoleAssignmentMemberOptions,
          expectedMemberId,
          expectedRoles,
          expectedLocusUrl
        );
        assert.calledOnceWithExactly(spies.assignRolesMember, {
          memberId: expectedMemberId,
          roles: expectedRoles,
          locusUrl: expectedLocusUrl,
        });
        assert.strictEqual(resolvedValue, resolvedValue);
      };

      it('should not make a request if there is no member id', async () => {
        const {members, spies} = setup(url1);

        const resultPromise = members.assignRoles();

        await checkInvalid(
          resultPromise,
          'The member id must be defined to assign the roles to a member.',
          spies,
        );
      });

      it('should not make a request if there is no locus url', async () => {
        const {members, spies} = setup();

        const resultPromise = members.assignRoles(uuid.v4());

        await checkInvalid(
          resultPromise,
          'The associated locus url for this meetings members object must be defined.',
          spies,
        );
      });

      it('should not make a request if locus throws ReclaimHostNotSupportedError', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1, 2400127);

        const resultPromise = members.assignRoles(memberId, fakeRoles);

        await checkError(
          ReclaimHostNotSupportedError,
          memberId,
          fakeRoles,
          url1,
          resultPromise,
          'Non converged meetings, PSTN or SIP users in converged meetings are not supported currently.',
          spies,
        );
      });

      it('should not make a request if locus throws ReclaimHostNotAllowedError', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1, 2403135);

        const resultPromise = members.assignRoles(memberId, fakeRoles);

        await checkError(
          ReclaimHostNotAllowedError,
          memberId,
          fakeRoles,
          url1,
          resultPromise,
          'Reclaim Host Role Not Allowed For Other Participants. Participants cannot claim host role in PMR meeting, space instant meeting or escalated instant meeting. However, the original host still can reclaim host role when it manually makes another participant to be the host.',
          spies,
        );
      });

      it('should not make a request if locus throws ReclaimHostEmptyWrongKeyError', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1, 2403136);

        const resultPromise = members.assignRoles(memberId, fakeRoles);

        await checkError(
          ReclaimHostEmptyWrongKeyError,
          memberId,
          fakeRoles,
          url1,
          resultPromise,
          'Host Key Not Specified Or Matched. The original host can reclaim the host role without entering the host key. However, any other person who claims the host role must enter the host key to get it.',
          spies,
        );
      });

      it('should not make a request if locus throws ReclaimHostIsHostAlreadyError', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1, 2409150);

        const resultPromise = members.assignRoles(memberId, fakeRoles);

        await checkError(
          ReclaimHostIsHostAlreadyError,
          memberId,
          fakeRoles,
          url1,
          resultPromise,
          'Participant Having Host Role Already. Participant who sends request to reclaim host role has already a host role.',
          spies,
        );
      });

      it('should not make a request if locus throws a different error', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1, 1234);

        const resultPromise = members.assignRoles(memberId, fakeRoles);

        await checkError(
          {body: {errorCode: 1234}, message: genericMessage},
          memberId,
          fakeRoles,
          url1,
          resultPromise,
          genericMessage,
          spies,
        );
      });

      it('should make the correct request when called with roles', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1);

        const resultPromise = members.assignRoles(memberId, fakeRoles);

        await checkValid(
          resultPromise,
          spies,
          memberId,
          fakeRoles,
          url1,
        );
      });
    });

    describe('#raiseOrLowerHand', () => {
      const setup = (locusUrl) => {
        const members = createMembers({url: locusUrl});

        const spies = {
          generateRaiseHandMemberOptions: sandbox.spy(
            MembersUtil,
            'generateRaiseHandMemberOptions'
          ),
          raiseOrLowerHandMember: sandbox.spy(members.membersRequest, 'raiseOrLowerHandMember'),
        };

        return {members, spies};
      };

      const checkInvalid = async (resultPromise, expectedMessage, spies) => {
        await assert.isRejected(resultPromise, ParameterError, expectedMessage);
        assert.notCalled(spies.generateRaiseHandMemberOptions);
        assert.notCalled(spies.raiseOrLowerHandMember);
      };

      const checkValid = async (
        resultPromise,
        spies,
        expectedMemberId,
        expectedRaise,
        expectedLocusUrl
      ) => {
        await assert.isFulfilled(resultPromise);
        assert.calledOnceWithExactly(
          spies.generateRaiseHandMemberOptions,
          expectedMemberId,
          expectedRaise,
          expectedLocusUrl
        );
        assert.calledOnceWithExactly(spies.raiseOrLowerHandMember, {
          memberId: expectedMemberId,
          raised: expectedRaise,
          locusUrl: expectedLocusUrl,
        });
        assert.strictEqual(resultPromise, spies.raiseOrLowerHandMember.getCall(0).returnValue);
      };

      it('should not make a request if there is no member id', async () => {
        const {members, spies} = setup(url1);

        const resultPromise = members.raiseOrLowerHand();

        await checkInvalid(
          resultPromise,
          'The member id must be defined to raise/lower the hand of the member.',
          spies
        );
      });

      it('should not make a request if there is no locus url', async () => {
        const {members, spies} = setup();

        const resultPromise = members.raiseOrLowerHand(uuid.v4());

        await checkInvalid(
          resultPromise,
          'The associated locus url for this meetings members object must be defined.',
          spies
        );
      });

      it('should make the correct request when called with raise as true', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1);

        const resultPromise = members.raiseOrLowerHand(memberId, true);

        await checkValid(resultPromise, spies, memberId, true, url1);
      });

      it('should make the correct request when called with raise as false', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1);

        const resultPromise = members.raiseOrLowerHand(memberId, false);

        await checkValid(resultPromise, spies, memberId, false, url1);
      });

      it('should make the correct request when called with raise as default', async () => {
        const memberId = uuid.v4();
        const {members, spies} = setup(url1);

        const resultPromise = members.raiseOrLowerHand(memberId);

        await checkValid(resultPromise, spies, memberId, true, url1);
      });
    });

    describe('#lowerAllHands', () => {
      const setup = (locusUrl) => {
        const members = createMembers({url: locusUrl});

        const spies = {
          generateLowerAllHandsMemberOptions: sandbox.spy(
            MembersUtil,
            'generateLowerAllHandsMemberOptions'
          ),
          lowerAllHandsMember: sandbox.spy(members.membersRequest, 'lowerAllHandsMember'),
        };

        return {members, spies};
      };

      const checkInvalid = async (resultPromise, expectedMessage, spies) => {
        await assert.isRejected(resultPromise, ParameterError, expectedMessage);
        assert.notCalled(spies.generateLowerAllHandsMemberOptions);
        assert.notCalled(spies.lowerAllHandsMember);
      };

      const checkValid = async (
        resultPromise,
        spies,
        expectedRequestingMemberId,
        expectedLocusUrl
      ) => {
        await assert.isFulfilled(resultPromise);
        assert.calledOnceWithExactly(
          spies.generateLowerAllHandsMemberOptions,
          expectedRequestingMemberId,
          expectedLocusUrl
        );
        assert.calledOnceWithExactly(spies.lowerAllHandsMember, {
          requestingParticipantId: expectedRequestingMemberId,
          locusUrl: expectedLocusUrl,
        });
        assert.strictEqual(resultPromise, spies.lowerAllHandsMember.getCall(0).returnValue);
      };

      it('should not make a request if there is no requestingMemberId', async () => {
        const {members, spies} = setup(url1);

        const resultPromise = members.lowerAllHands();

        await checkInvalid(
          resultPromise,
          'The requestingMemberId must be defined to lower all hands in a meeting.',
          spies
        );
      });

      it('should not make a request if there is no locus url', async () => {
        const {members, spies} = setup();

        const resultPromise = members.lowerAllHands(uuid.v4());

        await checkInvalid(
          resultPromise,
          'The associated locus url for this meetings members object must be defined.',
          spies
        );
      });

      it('should make the correct request when called with requestingMemberId', async () => {
        const requestingMemberId = uuid.v4();
        const {members, spies} = setup(url1);

        const resultPromise = members.lowerAllHands(requestingMemberId);

        await checkValid(resultPromise, spies, requestingMemberId, url1);
      });
    });

    describe('#editDisplayName', () => {
      const setup = (locusUrl) => {
        const members = createMembers({url: locusUrl});

        const spies = {
          generateEditDisplayNameMemberOptions: sandbox.spy(
            MembersUtil,
            'generateEditDisplayNameMemberOptions'
          ),
          editDisplayNameMember: sandbox.spy(members.membersRequest, 'editDisplayNameMember'),
        };

        return {members, spies};
      };

      const checkInvalid = async (resultPromise, expectedMessage, spies) => {
        await assert.isRejected(resultPromise, ParameterError, expectedMessage);
        assert.notCalled(spies.generateEditDisplayNameMemberOptions);
        assert.notCalled(spies.editDisplayNameMember);
      };

      const checkValid = async (
        resultPromise,
        spies,
        expectedMemberId,
        expectedRequestingParticipantId,
        expectedAlias,
        expectedLocusUrl
      ) => {
        await assert.isFulfilled(resultPromise);
        assert.calledOnceWithExactly(
          spies.generateEditDisplayNameMemberOptions,
          expectedMemberId,
          expectedRequestingParticipantId,
          expectedAlias,
          expectedLocusUrl
        );
        assert.calledOnceWithExactly(spies.editDisplayNameMember, {
          memberId: expectedMemberId,
          requestingParticipantId: expectedRequestingParticipantId,
          alias: expectedAlias,
          locusUrl: expectedLocusUrl,
        });
        assert.strictEqual(resultPromise, spies.editDisplayNameMember.getCall(0).returnValue);
      };

      it('should not make a request if there is no memberId', async () => {
        const {members, spies} = setup(url1);

        const resultPromise = members.editDisplayName();

        await checkInvalid(
          resultPromise,
          'The member id must be defined to edit display name of the member.',
          spies
        );
      });

      it('should not make a request if there is no locus url', async () => {
        const {members, spies} = setup();

        const resultPromise = members.editDisplayName(uuid.v4());

        await checkInvalid(
          resultPromise,
          'The associated locus url for this meetings members object must be defined.',
          spies
        );
      });

      it('should make the correct request when called with respective parameters', async () => {
        const requestingParticipantId = uuid.v4();
        const memberId = uuid.v4();
        const alias = 'aliasName';
        const {members, spies} = setup(url1);

        const resultPromise = members.editDisplayName(memberId, requestingParticipantId, alias);

        await checkValid(resultPromise, spies, memberId, requestingParticipantId, alias, url1);
      });
    });

    describe('findMemberByCsi()', () => {
      let members;

      // fake collection that contains all combinations of members data structure (with respect to CSIs)
      const fakeCollection = {
        oneWithoutDevices: {
          participant: {},
        },
        oneWithEmptyDevices: {
          participant: {
            devices: [],
          },
        },
        oneWithDevicesWithoutCsis: {
          participant: {
            devices: [
              {
                url: 'https://fakeURL1.com',
                deviceType: 'SIP',
                state: 'JOINED',
                csis: [],
              },
              {
                url: 'dialout:///fakeagain',
                deviceType: 'PROVISIONAL',
                state: 'JOINED',
              },
            ],
          },
          id: 'abc-123-abc-123',
          status: 'IN_MEETING',
        },
        oneWithSomeCsis: {
          participant: {
            devices: [
              {
                url: 'https://fakeURL2.com',
                deviceType: 'SIP',
                state: 'JOINED',
                csis: [1000, 1001, 1002],
              },
              {
                url: 'https://fakeURL3.com',
                deviceType: 'SIP',
                state: 'JOINED',
                csis: [2000, 2001, 2002],
              },
            ],
          },
        },
      };

      beforeEach(() => {
        members = createMembers({url: url1});
        members.membersCollection.setAll(fakeCollection);
      });

      it('returns undefined if member not found', () => {
        assert.strictEqual(members.findMemberByCsi(123), undefined);
      });

      it('returns correct member when CSI matches the first device', () => {
        assert.strictEqual(members.findMemberByCsi(1001), fakeCollection.oneWithSomeCsis);
      });

      it('returns correct member when CSI matches the second device', () => {
        assert.strictEqual(members.findMemberByCsi(2001), fakeCollection.oneWithSomeCsis);
      });
    });

    describe('getCsisForMember()', () => {
      let members;

      // fake collection that contains all combinations of members data structure (with respect to CSIs)
      const fakeCollection = {
        oneWithoutParticipant: {
          id: 'oneWithoutParticipant',
        },
        oneWithoutDevices: {
          id: 'oneWithoutDevices',
          participant: {},
        },
        oneWithEmptyDevices: {
          id: 'oneWithEmptyDevices',
          participant: {
            devices: [],
          },
        },
        oneWithDevicesWithoutCsis: {
          id: 'oneWithDevicesWithoutCsis',
          participant: {
            devices: [
              {
                url: 'https://fakeURL1.com',
                deviceType: 'SIP',
                state: 'JOINED',
                mediaSessions: [],
              },
              {
                url: 'dialout:///fakeagain',
                deviceType: 'PROVISIONAL',
                state: 'JOINED',
              },
            ],
          },
          status: 'IN_MEETING',
        },
        oneWithSomeCsis: {
          id: 'oneWithSomeCsis',
          participant: {
            devices: [
              {
                url: 'https://fakeURL2.com',
                deviceType: 'SIP',
                state: 'JOINED',
                mediaSessions: [
                  {mediaType: 'audio', mediaContent: 'main', csi: 1000},
                  {mediaType: 'video', mediaContent: 'main', csi: 1001},
                  {mediaType: 'video', mediaContent: 'content', csi: 1002},
                ],
              },
              {
                url: 'https://fakeURL3.com',
                deviceType: 'SIP',
                state: 'JOINED',
                mediaSessions: [
                  {mediaType: 'audio', mediaContent: 'main', csi: 2000},
                  {mediaType: 'video', mediaContent: 'main', csi: 2001},
                  {mediaType: 'video', mediaContent: 'content', csi: 2002},
                ],
              },
            ],
          },
        },
      };

      beforeEach(() => {
        members = createMembers({url: url1});
        members.membersCollection.setAll(fakeCollection);
      });

      it('returns empty array if member not found', () => {
        assert.deepEqual(members.getCsisForMember('wrong id'), []);
      });

      it('returns empty array if member does not have CSIs', () => {
        assert.deepEqual(members.getCsisForMember('oneWithoutParticipant'), []);
        assert.deepEqual(members.getCsisForMember('oneWithoutDevices'), []);
        assert.deepEqual(members.getCsisForMember('oneWithEmptyDevices'), []);
        assert.deepEqual(members.getCsisForMember('oneWithDevicesWithoutCsis'), []);
      });

      it('returns empty array if mediaType and mediaContent do not match', () => {
        assert.deepEqual(members.getCsisForMember('oneWithSomeCsis', 'audio', 'content'), []);
      });

      it('returns correct CSI values when there is a match', () => {
        assert.deepEqual(
          members.getCsisForMember('oneWithSomeCsis', 'video', 'main'),
          [1001, 2001]
        );
      });
    });
  });
});
