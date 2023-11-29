import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Reachability, {ICECandidateResult, ReachabilityResults} from '@webex/plugin-meetings/src/reachability/';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';

import { IP_VERSION } from '@webex/plugin-meetings/src/constants';

describe('isAnyPublicClusterReachable', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex();

    sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);
  });

  afterEach(() => {
    sinon.restore();
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

    const result = await reachability.isAnyPublicClusterReachable();

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

  describe('ignores video mesh reachability', () => {
    it('returns false if there are no public cluster results, only video mesh', async () => {
      await checkIsClusterReachable({
        x: {
          udp: {reachable: 'true'},
          tcp: {reachable: 'true'},
          isVideoMesh: true,
        },
        y: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true'},
          isVideoMesh: true,
        }
      }, false);
    });

    it('returns false if there public cluster reachability failed, only video mesh succeeded', async () => {
      await checkIsClusterReachable({
        x: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true'},
          isVideoMesh: true,
        },
        y: {
          udp: {reachable: 'true'},
          tcp: {reachable: 'false'},
          isVideoMesh: true,
        },
        publicOne: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'false'},
          isVideoMesh: false,
        }
      }, false);
    });

    it('returns true if there is at least 1 public cluster result, while video mesh is not reachable', async () => {
      await checkIsClusterReachable({
        x: {
          udp: {reachable: 'true'},
          tcp: {reachable: 'true'},
          isVideoMesh: true,
        },
        y: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true'},
          isVideoMesh: true,
        },
        publicOne: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true'},
          isVideoMesh: false,
        }
      }, true);
    });
  })
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
      public testParseIceResultsToInternalReachabilityResults(iceResults: Array<ICECandidateResult>) {
        return this.parseIceResultsToInternalReachabilityResults(iceResults);
      }
      public testAddPublicIP(peerConnection: RTCPeerConnection, publicIP?: string | null) {
        return this.addPublicIP(peerConnection, publicIP);
      }
    }
    beforeEach(() => {
      testingClass = new TestReachability({webex});
    });

    it('calls parseIceResultsToInternalReachabilityResults correctly', () => {
      const res = testingClass.testParseIceResultsToInternalReachabilityResults([
        {
          clusterId: 'id1',
          elapsed: '12312',
          publicIPs: ['1.1.1.1'],
          isVideoMesh: true,
        },
        {
          clusterId: 'id2',
          elapsed: null,
          publicIPs: ['1.1.1.1'],
          isVideoMesh: false,
        },
        {
          clusterId: 'id2',
          elapsed: '14123',
          publicIPs: undefined,
          isVideoMesh: false,
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
          isVideoMesh: true,
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
          isVideoMesh: false,
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
});

describe('getReachabilityResults', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex();
  });

  afterEach(() => {
    sinon.restore();
  });

  const runCheck = async (mockStorage: any, expectedResult: ReachabilityResults) => {
    if (mockStorage) {
      await webex.boundedStorage.put(
        'Reachability',
        'reachability.result',
        JSON.stringify(mockStorage)
      );
    }
    const reachability = new Reachability(webex);

    const result = await reachability.getReachabilityResults();

    assert.deepEqual(result, expectedResult);
  };

  it('returns undefined if reading from local storage fails', async () => {
    sinon.stub(webex.boundedStorage, 'get').rejects(new Error('fake error'));

    const reachability = new Reachability(webex);

    const result = await reachability.getReachabilityResults();

    assert.isUndefined(result);
  });

  it('returns results from local storage, stripping any internal data', async () => {
    await runCheck(
      // mock storage:
      {
        cluster1: {
          udp: {reachable: 'true', latencyInMilliseconds: '100'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
        },
        cluster2: {
          udp: {reachable: 'true', latencyInMilliseconds: '200'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
          isVideoMesh: true,
        },
        cluster3: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.10']},
          xtls: {untested: 'true'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        cluster4: {
          udp: {reachable: 'false', latencyInMilliseconds: '300'},
          tcp: {reachable: 'false', untested: 'true'},
          xtls: {untested: 'true'},
          someOtherField: 'any value',
        },
      },
      // expected result (same as above, but with isVideoMesh and someOtherField stripped out):
      {
        cluster1: {
          udp: {reachable: 'true', latencyInMilliseconds: '100'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
        },
        cluster2: {
          udp: {reachable: 'true', latencyInMilliseconds: '200'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
        },
        cluster3: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.10']},
          xtls: {untested: 'true'},
        },
        cluster4: {
          udp: {reachable: 'false', latencyInMilliseconds: '300'},
          tcp: {reachable: 'false', untested: 'true'},
          xtls: {untested: 'true'},
        },
      }
    );
  });
});

describe('getReachabilityMetrics', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex();
  });

  afterEach(() => {
    sinon.restore();
  });

  const runCheck = async (mockStorage: any, expectedResult: any) => {
    if (mockStorage) {
      await webex.boundedStorage.put(
        'Reachability',
        'reachability.result',
        JSON.stringify(mockStorage)
      );
    }
    const reachability = new Reachability(webex);
    const result = await reachability.getReachabilityMetrics();

    assert.deepEqual(result, expectedResult);
  };

  it('returns all zeros if reading from local storage fails', async () => {
    sinon.stub(webex.boundedStorage, 'get').rejects(new Error('fake error'));

    const reachability = new Reachability(webex);

    const result = await reachability.getReachabilityMetrics();

    assert.deepEqual(result, {
      reachability_public_udp_success: 0,
      reachability_public_udp_failed: 0,
      reachability_public_tcp_success: 0,
      reachability_public_tcp_failed: 0,
      reachability_vmn_udp_success: 0,
      reachability_vmn_udp_failed: 0,
      reachability_vmn_tcp_success: 0,
      reachability_vmn_tcp_failed: 0,
    });
  });

  it('returns correct stats based on local storage results', async () => {
    await runCheck(
      // mock storage:
      {
        public1: {
          udp: {reachable: 'true', latencyInMilliseconds: '100'},
          tcp: {untested: 'true'},
          xtls: {untested: 'true'},
        },
        vmn1: {
          udp: {reachable: 'true', latencyInMilliseconds: '200'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
          isVideoMesh: true,
        },
        vmn2: {
          udp: {untested: 'true'},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.10']},
          xtls: {untested: 'true'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        public2: {
          udp: {reachable: 'false', latencyInMilliseconds: '300'},
          tcp: {reachable: 'false', untested: 'true'},
          xtls: {untested: 'true'},
          someOtherField: 'any value',
        },
        public3: {
          udp: {reachable: 'true', latencyInMilliseconds: '400', clientMediaIPs: ['10.10.10.10']},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.10']},
          xtls: {untested: 'true'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public4: {
          udp: {reachable: 'true', latencyInMilliseconds: '40', clientMediaIPs: ['10.10.10.11']},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.11']},
          xtls: {untested: 'true'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public5: {
          udp: {reachable: 'false'},
          tcp: {untested: 'true'},
          xtls: {untested: 'true'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
      },
      // expected result:
      {
        reachability_public_udp_success: 3,
        reachability_public_udp_failed: 2,
        reachability_public_tcp_success: 2,
        reachability_public_tcp_failed: 1,
        reachability_vmn_udp_success: 1,
        reachability_vmn_udp_failed: 0,
        reachability_vmn_tcp_success: 1,
        reachability_vmn_tcp_failed: 1,
      }
    );
  });

  it('returns correct stats when only public nodes were tested', async () => {
    await runCheck(
      // mock storage:
      {
        public1: {
          udp: {reachable: 'true', latencyInMilliseconds: '400', clientMediaIPs: ['10.10.10.10']},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.10']},
          xtls: {untested: 'true'},
          isVideoMesh: false,
        },
        public2: {
          udp: {reachable: 'true', latencyInMilliseconds: '100'},
          tcp: {untested: 'true'},
          xtls: {untested: 'true'},
        },
        public3: {
          udp: {reachable: 'false', latencyInMilliseconds: '300'},
          tcp: {reachable: 'false', untested: 'true'},
          xtls: {untested: 'true'},
          someOtherField: 'any value',
        },
        public4: {
          udp: {untested: 'true'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public5: {
          udp: {reachable: 'true', latencyInMilliseconds: '400', clientMediaIPs: ['10.10.10.10']},
          tcp: {untested: 'true'},
          xtls: {untested: 'true'},
        },
      },
      // expected result:
      {
        reachability_public_udp_success: 3,
        reachability_public_udp_failed: 1,
        reachability_public_tcp_success: 1,
        reachability_public_tcp_failed: 2,
        reachability_vmn_udp_success: 0,
        reachability_vmn_udp_failed: 0,
        reachability_vmn_tcp_success: 0,
        reachability_vmn_tcp_failed: 0,
      }
    );
  });

  it('returns correct stats when only video mesh nodes were tested', async () => {
    await runCheck(
      // mock storage:
      {
        vmn1: {
          udp: {reachable: 'false'},
          tcp: {reachable: 'true', latencyInMilliseconds: '100', clientMediaIPs: ['10.10.10.10']},
          xtls: {untested: 'true'},
          isVideoMesh: true,
        },
        vmn2: {
          udp: {reachable: 'true', latencyInMilliseconds: '200', clientMediaIPs: ['10.10.10.10']},
          tcp: {untested: 'true'},
          xtls: {untested: 'true'},
          isVideoMesh: true,
        },
        vmn3: {
          udp: {reachable: 'true', latencyInMilliseconds: '300', clientMediaIPs: ['10.10.10.10']},
          tcp: {reachable: 'false', untested: 'true'},
          xtls: {untested: 'true'},
          isVideoMesh: true,
        },
        vmn4: {
          udp: {untested: 'true'},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        vmn5: {
          udp: {reachable: 'true', latencyInMilliseconds: '200', clientMediaIPs: ['10.10.10.10']},
          tcp: {reachable: 'false'},
          xtls: {untested: 'true'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
      },
      // expected result:
      {
        reachability_public_udp_success: 0,
        reachability_public_udp_failed: 0,
        reachability_public_tcp_success: 0,
        reachability_public_tcp_failed: 0,
        reachability_vmn_udp_success: 3,
        reachability_vmn_udp_failed: 1,
        reachability_vmn_tcp_success: 1,
        reachability_vmn_tcp_failed: 3,
      }
    );
  });
});