import 'jsdom-global/register';
import sinon from 'sinon';
import chai from 'chai';
import uuid from 'uuid';
import chaiAsPromised from 'chai-as-promised';
import MockWebex from '@webex/test-helper-mock-webex';

import Meetings from '@webex/plugin-meetings';
import MembersRequest from '@webex/plugin-meetings/src/members/request';
import membersUtil from '@webex/plugin-meetings/src/members/util';
import ParameterError from '@webex/plugin-meetings/src/common/errors/parameter';
import { merge } from 'lodash';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  let membersRequest;
  let url1;
  let sandbox;
  const sequence = {some: 'sequenceData'};
  const requestResponse = {some: 'data'};
  let locusDeltaRequestSpy;
  const correlationId = '12345';

  beforeEach(() => {
    const webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    sandbox = sinon.createSandbox();

    sinon.stub(uuid, 'v4').returns(correlationId);

    url1 = `https://example.com/${uuid.v4()}`;

    const request = sinon.mock().returns(Promise.resolve(requestResponse));

    membersRequest = new MembersRequest(
      {
        meeting: {
          request,
          locusInfo: {
            sequence,
          },
        },
      },
      {
        parent: webex,
      }
    );
    locusDeltaRequestSpy = sinon.spy(membersRequest, 'locusDeltaRequest');

    membersRequest.request = request;
  });

  afterEach(() => {
    sandbox.restore();
    uuid.v4.restore();
  });

  const checkRequest = (expectedParams) => {
    assert.calledOnceWithExactly(locusDeltaRequestSpy, expectedParams);
    assert.calledOnceWithExactly(
      membersRequest.request,
      merge(expectedParams, {body: {sequence}})
    );
  };

  describe('members request library', () => {
    describe('#sendDialPadKey', () => {
      it('sends a POST to the sendDtmf locus endpoint', async () => {
        const locusUrl = url1;
        const url = 'https://fakedeviceurl.com';
        const tones = '1';
        const memberId = 'test1';

        await membersRequest.sendDialPadKey({
          url,
          tones,
          memberId,
          locusUrl,
        });

        checkRequest({
          method: 'POST',
          uri: `${locusUrl}/participant/${memberId}/sendDtmf`,
          body: {
            memberId,
            dtmf: {
              direction: 'transmit',
              correlationId,
              tones,
            },
            device: {
              url,
            }
          }
        });
      });
    });

    describe('#addMembers', () => {
      it('sends a PUT to the locus endpoint', async () => {
        const options = {
          invitee: {
            phoneNumber: '+18578675309',
          },
          locusUrl: url1,
        };

        await membersRequest.addMembers(options);

        checkRequest({
          method: 'PUT',
          uri: url1,
          body: {
            alertIfActive: undefined,
            invitees: [{address: '+18578675309'}]
          }
        })
      });
    });

    describe('#admitMember', () => {
      it('sends a request to admit members', async () => {
        const options = {
          locusUrl: url1,
          memberIds: ['1', '2'],
        };

        await membersRequest.admitMember(options)

        checkRequest({
          method: 'PUT',
          uri: 'https://example.com/12345/controls',
          body: {
            admit: {
              participantIds: options.memberIds
            }
          }
        });
      });
    });

    describe('#removeMember', () => {
      it('sends a request to remove a member', async () => {
        const options = {
          locusUrl: url1,
          memberId: 'member1',
        };

        await membersRequest.removeMember(options);

        checkRequest({
          method: 'PUT',
          uri: 'https://example.com/12345/participant/member1/leave',
          body: {
            reason: undefined
          },
        });
      });
    });

    describe('#muteMember', () => {
      it('sends a request to mute a member', async () => {
        const options = {
          locusUrl: url1,
          memberId: 'member1',
          muted: true,
        };

        await membersRequest.muteMember(options);

        checkRequest({
          method: 'PATCH',
          uri: 'https://example.com/12345/participant/member1/controls',
          body: {audio: {muted: true}},
        });
      });
    });

    describe('#transferHostToMember', () => {
      it('sends a request to transfer host to a member', async () => {
        const options = {
          locusUrl: url1,
          memberId: 'member1',
          moderator: true,
        };

        await membersRequest.transferHostToMember(options);

        checkRequest({
          method: 'PATCH',
          uri: 'https://example.com/12345/participant/member1/controls',
          body: {role: {moderator: true}},
        });
      });
    });

    describe('#cancelPhoneInvite', () => {
      it('sends a PUT to the locus endpoint', async () => {
        const options = {
          invitee: {
            phoneNumber: '+18578675309',
          },
          locusUrl: url1,
        };

        await membersRequest.cancelPhoneInvite(options);

        checkRequest({
          method: 'PUT',
          uri: url1,
          body: {
            invitees: [{address: '+18578675309'}],
            actionType: 'REMOVE',
          },
        });
      });
    });

    describe('#assignRolesMember', () => {
      it('sends a PATCH to the locus endpoint', async () => {
        const locusUrl = url1;
        const memberId = 'test1';
        const roles = [
          {type: 'PRESENTER', hasRole: true},
          {type: 'MODERATOR', hasRole: false},
          {type: 'COHOST', hasRole: true},
        ];

        const options = {
          memberId,
          locusUrl,
          roles,
        };

        await membersRequest.assignRolesMember(options);

        checkRequest({
          method: 'PATCH',
          uri: `${locusUrl}/participant/${memberId}/controls`,
          body: {
            role: {
              roles
            }
          }
        });
      });
    });

    describe('#raiseHand', () => {
      it('sends a PATCH to the locus endpoint', async () => {
        const locusUrl = url1;
        const memberId = 'test1';

        const options = {
          memberId,
          locusUrl,
          raised: true,
        };

        await membersRequest.raiseOrLowerHandMember(options);

        checkRequest({
          method: 'PATCH',
          uri: `${locusUrl}/participant/${memberId}/controls`,
          body: {
            hand: {
              raised: true
            }
          }
        });
      });
    });

    describe('#lowerAllHands', () => {
      const parameterErrorMessage =
        'requestingParticipantId must be defined, and the associated locus url for this meeting object must be defined.';

      const checkInvalid = async (functionParams) => {
        assert.throws(
          () => membersRequest.lowerAllHandsMember(functionParams),
          ParameterError,
          parameterErrorMessage
        );
        assert(membersRequest.request.notCalled);
        assert(membersUtil.getLowerAllHandsMemberRequestParams.notCalled);
      };

      it('rejects if no options are passed in', async () => {
        checkInvalid();
      });

      it('rejects if no locusUrl are passed in', async () => {
        checkInvalid({requestingParticipantId: 'test'});
      });

      it('rejects if no requestingParticipantId are passed in', async () => {
        checkInvalid({locusUrl: 'test'});
      });

      it('returns a promise', async () => {
        const locusUrl = url1;
        const memberId = 'test1';

        const options = {
          requestingParticipantId: memberId,
          locusUrl,
        };

        const result = await membersRequest.lowerAllHandsMember(options);

        assert.strictEqual(result, requestResponse);
      });

      it('sends a PATCH to the locus endpoint', async () => {
        const locusUrl = url1;
        const memberId = 'test1';

        const options = {
          requestingParticipantId: memberId,
          locusUrl,
        };

        const getRequestParamsSpy = sandbox.spy(membersUtil, 'getLowerAllHandsMemberRequestParams');

        await membersRequest.lowerAllHandsMember(options);

        assert.calledOnceWithExactly(getRequestParamsSpy, {
          requestingParticipantId: memberId,
          locusUrl: url1,
        });

        checkRequest({
          method: 'PATCH',
          uri: `${locusUrl}/controls`,
          body: {
            hand: {
              raised: false,
            },
            requestingParticipantId: memberId,
          },
        });
      });
    });

    describe('#editDisplayName', () => {
      it('sends a POST request to the locus endpoint', async () => {
        const locusUrl = url1;
        const memberId = 'test1';
        const requestingParticipantId = 'test2';
        const aliasValue = 'alias';

        const options = {
          memberId,
          requestingParticipantId,
          alias: aliasValue,
          locusUrl,
        };

        await membersRequest.editDisplayNameMember(options);

        checkRequest({
          method: 'POST',
          uri: `${locusUrl}/participant/${memberId}/alias`,
          body: {
            aliasValue,
            requestingParticipantId,
          }
        });
      });
    });
  });
});
