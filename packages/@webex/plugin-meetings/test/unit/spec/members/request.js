import sinon from 'sinon';
import chai from 'chai';
import uuid from 'uuid';
import chaiAsPromised from 'chai-as-promised';
import MockWebex from '@webex/test-helper-mock-webex';

import Meetings from '@webex/plugin-meetings';
import MembersRequest from '@webex/plugin-meetings/src/members/request';
import membersUtil from '@webex/plugin-meetings/src/members/util';
import ParameterError from '@webex/plugin-meetings/src/common/errors/parameter';

const {assert} = chai;

chai.use(chaiAsPromised);
sinon.assert.expose(chai.assert, {prefix: ''});

describe('plugin-meetings', () => {
  let membersRequest;
  let url1;
  let sandbox;

  beforeEach(() => {
    const webex = new MockWebex({
      children: {
        meetings: Meetings
      }
    });

    sandbox = sinon.createSandbox();

    url1 = `https://example.com/${uuid.v4()}`;

    membersRequest = new MembersRequest({}, {
      parent: webex
    });
    membersRequest.request = sinon.mock().returns(Promise.resolve({}));
  });

  afterEach(() => {
    sandbox.restore();
  });


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
          locusUrl
        });
        const requestParams = membersRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'POST');
        assert.equal(requestParams.uri, `${locusUrl}/participant/${memberId}/sendDtmf`);
        assert.equal(requestParams.body.dtmf.tones, tones);
        assert.equal(requestParams.body.device.url, url);
      });
    });

    describe('#addMembers', () => {
      it('sends a PUT to the locus endpoint', async () => {
        const options = {
          invitee: {
            phoneNumber: '+18578675309'
          },
          locusUrl: url1
        };

        await membersRequest.addMembers(options);
        const requestParams = membersRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'PUT');
        assert.equal(requestParams.uri, url1);
        assert.equal(requestParams.body.invitees[0].address, '+18578675309');
      });
    });

    describe('#cancelPhoneInvite', () => {
      it('sends a PUT to the locus endpoint', async () => {
        const options = {
          invitee: {
            phoneNumber: '+18578675309'
          },
          locusUrl: url1
        };

        await membersRequest.cancelPhoneInvite(options);
        const requestParams = membersRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'PUT');
        assert.equal(requestParams.uri, url1);
        assert.equal(requestParams.body.invitees[0].address, '+18578675309');
        assert.equal(requestParams.body.actionType, 'REMOVE');
      });
    });

    describe('#raiseHand', () => {
      it('sends a PATCH to the locus endpoint', async () => {
        const locusUrl = url1;
        const memberId = 'test1';

        const options = {
          memberId,
          locusUrl,
          raised: true
        };

        await membersRequest.raiseOrLowerHandMember(options);
        const requestParams = membersRequest.request.getCall(0).args[0];

        assert.equal(requestParams.method, 'PATCH');
        assert.equal(requestParams.uri, `${locusUrl}/participant/${memberId}/controls`);
        assert.equal(requestParams.body.hand.raised, true);
      });
    });

    describe('#lowerAllHands', () => {
      const parameterErrorMessage = 'requestingParticipantId must be defined, and the associated locus url for this meeting object must be defined.';

      const checkInvalid = async (functionParams) => {
        assert.throws(() => membersRequest.lowerAllHandsMember(functionParams), ParameterError, parameterErrorMessage);
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

        assert.strictEqual(membersRequest.lowerAllHandsMember(options), membersRequest.request.getCall(0).returnValue);
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
          locusUrl: url1
        });

        const requestParams = membersRequest.request.getCall(0).args[0];

        assert.deepEqual(requestParams, {
          method: 'PATCH',
          uri: `${locusUrl}/controls`,
          body: {
            hand: {
              raised: false
            },
            requestingParticipantId: memberId
          }
        });
      });
    });
  });
});
