import 'jsdom-global/register';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import Meetings from '@webex/plugin-meetings';
import RoapRequest from '@webex/plugin-meetings/src/roap/request';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import {IP_VERSION, REACHABILITY} from '@webex/plugin-meetings/src/constants';

describe('plugin-meetings/roap', () => {
  let roapRequest;
  let webex;
  const locusUrl = 'locusUrl';

  beforeEach(async () => {
    webex = new MockWebex({
      children: {
        meetings: Meetings,
      },
    });

    webex.meetings.clientRegion = {
      countryCode: 'US',
      regionCode: 'WEST-COAST',
    };

    webex.meetings.reachability = {
      getReachabilityReportToAttachToRoap: sinon.stub().resolves({}),
      getClientMediaPreferences: sinon.stub().resolves({}),
    };

    webex.internal = {
      services: {
        get: sinon.mock().returns(locusUrl),
        waitForCatalog: sinon.mock().returns(Promise.resolve({})),
      },
      device: {
        url: 'url',
      },
      newMetrics: {
        submitClientEvent: sinon.stub()
      },
    };

    sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.ipv4_and_ipv6);

    // @ts-ignore
    roapRequest = new RoapRequest({webex});

    roapRequest.request = sinon.mock().returns(
      Promise.resolve({
        body: {
          locus: {
            roapSeq: '',
            id: '',
            url: 'url/path',
            fullState: {
              lastActive: 'lastActive',
            },
          },
        },
      })
    );

    await webex.boundedStorage.put(
      REACHABILITY.namespace,
      REACHABILITY.localStorageJoinCookie,
      JSON.stringify({
        anycastEntryPoint: 'aws-eu-west-1',
      })
    );
    await webex.boundedStorage.put(
      REACHABILITY.namespace,
      REACHABILITY.localStorageResult,
      JSON.stringify({
        clusterId: {
          udp: { result: 'reachable', latencyInMilliseconds: 10 },
          tcp: { result: 'unreachable' },
          isVideoMesh: false,
        },
      })
    );
  });

  afterEach(() => {
    sinon.restore();
  })

  describe('sendRoap', () => {
    it('includes clientMediaPreferences and reachability in the request correctly', async () => {
      const locusMediaRequest = {send: sinon.stub().resolves({body: {locus: {}}})};

      const FAKE_REACHABILITY_REPORT = {
        id: 'fake reachability report',
      };
      const FAKE_CLIENT_MEDIA_PREFERENCES = {
        id: 'fake client media preferences',
      };

      webex.meetings.reachability.getReachabilityReportToAttachToRoap.resolves(FAKE_REACHABILITY_REPORT);
      webex.meetings.reachability.getClientMediaPreferences.resolves(FAKE_CLIENT_MEDIA_PREFERENCES);

      await roapRequest.sendRoap({
        locusSelfUrl: locusUrl,
        mediaId: 'mediaId',
        roapMessage: {
          seq: 'seq',
        },
        meetingId: 'meeting-id',
        isMultistream: true,
        locusMediaRequest,
      });

      assert.calledOnceWithExactly(webex.meetings.reachability.getReachabilityReportToAttachToRoap);
      assert.calledOnceWithExactly(webex.meetings.reachability.getClientMediaPreferences, true, IP_VERSION.ipv4_and_ipv6);

      const requestParams = locusMediaRequest.send.getCall(0).args[0];
      assert.deepEqual(requestParams, {
        type: 'RoapMessage',
        selfUrl: locusUrl,
        clientMediaPreferences: FAKE_CLIENT_MEDIA_PREFERENCES,
        mediaId: 'mediaId',
        roapMessage: {
          seq: 'seq',
        },
        reachability: FAKE_REACHABILITY_REPORT,
      });
    });

    it('includes default clientMediaPreferences if calls to reachability fail', async () => {
      const locusMediaRequest = {send: sinon.stub().resolves({body: {locus: {}}})};

      webex.meetings.reachability.getClientMediaPreferences.rejects(new Error('fake error'));

      await roapRequest.sendRoap({
        locusSelfUrl: locusUrl,
        mediaId: 'mediaId',
        roapMessage: {
          seq: 'seq',
        },
        meetingId: 'meeting-id',
        isMultistream: true,
        locusMediaRequest,
      });

      assert.calledOnce(webex.meetings.reachability.getClientMediaPreferences);

      const requestParams = locusMediaRequest.send.getCall(0).args[0];
      assert.deepEqual(requestParams, {
        type: 'RoapMessage',
        selfUrl: locusUrl,
        clientMediaPreferences: {ipver: 0, joinCookie: undefined, preferTranscoding: false},
        mediaId: 'mediaId',
        roapMessage: {
          seq: 'seq',
        },
        reachability: undefined,
      });
    });
  });
});
