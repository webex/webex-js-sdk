import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Reachability, {ICECandidateResult} from '@webex/plugin-meetings/src/reachability/';
import { IP_VERSION } from '@webex/plugin-meetings/src/constants';

describe('isAnyClusterReachable', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex();
  });

  const checkIsClusterReachable = async (mockStorage: any, expectedValue: boolean) => {
    if (mockStorage) {
      await webex.boundedStorage.put(
        'Reachability',
        'reachability.result',
        JSON.stringify(mockStorage)
      );
    }
    const reachability = new Reachability(webex);

    const result = await reachability.isAnyClusterReachable();

    assert.equal(result, expectedValue);
  };

  it('returns true when udp is reachable', async () => {
    await checkIsClusterReachable({x: {udp: {reachable: 'true'}, tcp: {reachable: 'false'}}}, true);
  });

  it('returns true when tcp is reachable', async () => {
    await checkIsClusterReachable({x: {udp: {reachable: 'false'}, tcp: {reachable: 'true'}}}, true);
  });

  it('returns true when both tcp and udp are reachable', async () => {
    await checkIsClusterReachable({x: {udp: {reachable: 'true'}, tcp: {reachable: 'true'}}}, true);
  });

  it('returns false when both tcp and udp are unreachable', async () => {
    await checkIsClusterReachable({x: {udp: {reachable: 'false'}, tcp: {reachable: 'false'}}}, false);
  });

  it('returns false when reachability result is empty', async () => {
    await checkIsClusterReachable({x: {}}, false);
  });

  it('returns false when reachability.result item is not there', async () => {
    await checkIsClusterReachable(undefined, false);
  });
});

describe('gatherReachability', () => {
  let webex;

  beforeEach(async () => {
    webex = new MockWebex();

    await webex.boundedStorage.put(
      'Reachability',
      'reachability.result',
      JSON.stringify({old: 'results'})
    );
  });

  it('stores the reachability', async () => {
    const reachability = new Reachability(webex);

    const reachabilityResults = {
      clusters: {
        clusterId: {
          udp: 'testUDP',
        },
      },
    };
    const getClustersResult = {
      clusters: {clusterId: 'cluster'},
      joinCookie: {id: 'id'},
    };

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(getClustersResult);
    (reachability as any).performReachabilityCheck = sinon.stub().returns(reachabilityResults);

    const result = await reachability.gatherReachability();

    assert.equal(result, reachabilityResults);

    const storedResultForReachabilityResult = await webex.boundedStorage.get(
      'Reachability',
      'reachability.result'
    );
    const storedResultForJoinCookie = await webex.boundedStorage.get(
      'Reachability',
      'reachability.joinCookie'
    );

    assert.equal(JSON.stringify(result), storedResultForReachabilityResult);
    assert.equal(JSON.stringify(getClustersResult.joinCookie), storedResultForJoinCookie);
  });

  it('does reachability only on udp', async () => {
    const reachability = new Reachability(webex);

    const getClustersResult = {
      clusters: {clusterId: {
        tcp: [
          'stun:170.72.164.1:5004',
          'stun:170.72.165.2:5004'
        ],
        udp: [
            'stun:170.72.164.3:5004',
            'stun:170.72.164.3:9000',
        ],
        xtls: [
            'stun:external-media101.public.wjfkm-a-4.prod.infra.webex.com:443',
            'stun:external-media94.public.wjfkm-a-8.prod.infra.webex.com:443'
        ]
      }},
      joinCookie: {id: 'id'},
    };

    sinon.stub(reachability.reachabilityRequest, 'getClusters').returns(getClustersResult);

    const createPeerConnectionStub = sinon.stub(reachability, 'createPeerConnection');

    await reachability.gatherReachability();

    // check that a peer connection was created with only the udp urls 
    assert.calledOnceWithExactly(createPeerConnectionStub, {
      key: 'clusterId',
      config: {
        iceServers: [
          {
            username: '',
            credential: '',
            urls: ['stun:170.72.164.3:5004'],
          },
          {
            username: '',
            credential: '',
            urls: ['stun:170.72.164.3:9000'],
          }
        ],
        iceCandidatePoolSize: '0',
        iceTransportPolicy: 'all'
      }
    })
  });

  describe('clientMediaIPs', () => {
    let testingClass: TestReachability;

    class TestReachability extends Reachability {
      public testParseIceResultsToReachabilityResults(iceResults: Array<ICECandidateResult>) {
        return this.parseIceResultsToReachabilityResults(iceResults);
      }
      public testAddPublicIP(peerConnection: RTCPeerConnection, publicIP?: string | null) {
        return this.addPublicIP(peerConnection, publicIP);
      }
    }
    beforeEach(() => {
      testingClass = new TestReachability({webex});
    });

    it('calls parseIceResultsToReachabilityResults correctly', () => {
      const res = testingClass.testParseIceResultsToReachabilityResults([
        {
          clusterId: 'id1',
          elapsed: '12312',
          publicIPs: ['1.1.1.1'],
        },
        {
          clusterId: 'id2',
          elapsed: null,
          publicIPs: ['1.1.1.1'],
        },
        {
          clusterId: 'id2',
          elapsed: '14123',
          publicIPs: undefined,
        },
      ]);

      assert.deepEqual(res, {
        id1: {
          tcp: {
            untested: 'true',
          },
          xtls: {
            untested: 'true',
          },
          udp: {
            clientMediaIPs: ['1.1.1.1'],
            latencyInMilliseconds: '12312',
            reachable: 'true',
          },
        },
        id2: {
          xtls: {
            untested: 'true',
          },
          tcp: {
            untested: 'true',
          },
          udp: {
            latencyInMilliseconds: '14123',
            reachable: 'true',
          },
        },
      });
    });

    it('calls addPublicIP correctly with no existing public APIs', () => {
      const peerConnection = {
        connectionState: 'not_closed',
      };

      testingClass.testAddPublicIP(peerConnection as RTCPeerConnection, '1.1.1.1');

      assert.deepEqual(peerConnection, {
        connectionState: 'not_closed',
        publicIPs: ['1.1.1.1'],
      });
    });

    it('calls addPublicIP correctly with existing public APIs', () => {
      const peerConnection = {
        connectionState: 'not_closed',
        publicIPs: ['2.2.2.2'],
      };

      testingClass.testAddPublicIP(peerConnection as any, '1.1.1.1');

      assert.deepEqual(peerConnection, {
        connectionState: 'not_closed',
        publicIPs: ['2.2.2.2', '1.1.1.1'],
      });
    });

    it('calls addPublicIP correctly null publicAPI', () => {
      const peerConnection = {
        connectionState: 'not_closed',
      };

      testingClass.testAddPublicIP(peerConnection as RTCPeerConnection, null);

      assert.deepEqual(peerConnection, {
        connectionState: 'not_closed',
        publicIPs: null,
      });
    });
  });

  describe('getIpVersion', () => {
    it('returns unknown', () => {
      const reachability = new Reachability(webex);

      assert.equal(reachability.getIpVersion(), IP_VERSION.unknown);
    })
  })
});
