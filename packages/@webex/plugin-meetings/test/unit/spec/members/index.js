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

import Meetings from '@webex/plugin-meetings';
import ParameterError from '@webex/plugin-meetings/src/common/errors/parameter';
import Members from '@webex/plugin-meetings/src/members';
import MembersUtil from '@webex/plugin-meetings/src/members/util';

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

      createMembers = (options) => new Members({locusUrl: options.url}, {parent: webex});
    });

    afterEach(() => {
      sandbox.restore();
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
  });
});
