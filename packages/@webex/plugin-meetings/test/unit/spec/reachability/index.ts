import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import EventEmitter from 'events';
import testUtils from '../../../utils/testUtils';
import Reachability, {
  ReachabilityResults,
  ReachabilityResultsForBackend,
} from '@webex/plugin-meetings/src/reachability/';
import {ClusterNode} from '../../../../src/reachability/request';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import * as ClusterReachabilityModule from '@webex/plugin-meetings/src/reachability/clusterReachability';
import Metrics from '@webex/plugin-meetings/src/metrics';

import {IP_VERSION} from '@webex/plugin-meetings/src/constants';

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
    await checkIsClusterReachable(
      {x: {udp: {result: 'reachable'}, tcp: {result: 'unreachable'}}},
      true
    );
  });

  it('returns true when tcp is reachable', async () => {
    await checkIsClusterReachable(
      {x: {udp: {result: 'unreachable'}, tcp: {result: 'reachable'}}},
      true
    );
  });

  it('returns true when both tcp and udp are reachable', async () => {
    await checkIsClusterReachable(
      {x: {udp: {result: 'reachable'}, tcp: {result: 'reachable'}}},
      true
    );
  });

  it('returns false when both tcp and udp are unreachable', async () => {
    await checkIsClusterReachable(
      {x: {udp: {result: 'unreachable'}, tcp: {result: 'unreachable'}}},
      false
    );
  });

  it('returns false when reachability result is empty', async () => {
    await checkIsClusterReachable({x: {}}, false);
  });

  it('returns false when reachability.result item is not there', async () => {
    await checkIsClusterReachable(undefined, false);
  });

  describe('ignores video mesh reachability', () => {
    it('returns false if there are no public cluster results, only video mesh', async () => {
      await checkIsClusterReachable(
        {
          x: {
            udp: {result: 'reachable'},
            tcp: {result: 'reachable'},
            isVideoMesh: true,
          },
          y: {
            udp: {result: 'unreachable'},
            tcp: {result: 'reachable'},
            isVideoMesh: true,
          },
        },
        false
      );
    });

    it('returns false if there public cluster reachability failed, only video mesh succeeded', async () => {
      await checkIsClusterReachable(
        {
          x: {
            udp: {result: 'unreachable'},
            tcp: {result: 'reachable'},
            isVideoMesh: true,
          },
          y: {
            udp: {result: 'reachable'},
            tcp: {result: 'unreachable'},
            isVideoMesh: true,
          },
          publicOne: {
            udp: {result: 'unreachable'},
            tcp: {result: 'unreachable'},
            isVideoMesh: false,
          },
        },
        false
      );
    });

    it('returns true if there is at least 1 public cluster result, while video mesh is not reachable', async () => {
      await checkIsClusterReachable(
        {
          x: {
            udp: {result: 'reachable'},
            tcp: {result: 'reachable'},
            isVideoMesh: true,
          },
          y: {
            udp: {result: 'unreachable'},
            tcp: {result: 'reachable'},
            isVideoMesh: true,
          },
          publicOne: {
            udp: {result: 'unreachable'},
            tcp: {result: 'reachable'},
            isVideoMesh: false,
          },
        },
        true
      );
    });
  });
});

describe('isWebexMediaBackendUnreachable', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex();

    sinon.stub(MeetingUtil, 'getIpVersion').returns(IP_VERSION.unknown);
  });

  afterEach(() => {
    sinon.restore();
  });

  const runCheck = async (mockStorage: any, expectedValue: boolean) => {
    if (mockStorage) {
      await webex.boundedStorage.put(
        'Reachability',
        'reachability.result',
        JSON.stringify(mockStorage)
      );
    }
    const reachability = new Reachability(webex);

    const result = await reachability.isWebexMediaBackendUnreachable();

    assert.equal(result, expectedValue);
  };

  [
    {
      title: 'no clusters at all',
      mockStorage: {},
      expectedResult: false,
    },
    {
      title: 'clusters without results',
      mockStorage: {a: {}, b: {}},
      expectedResult: false,
    },
    {
      title: 'all clusters untested',
      mockStorage: {
        a: {udp: 'untested'},
        b: {udp: 'untested', tcp: 'untested'},
      },
      expectedResult: false,
    },
    {
      title: 'one cluster with udp reachable',
      mockStorage: {x: {udp: {result: 'reachable'}, tcp: {result: 'unreachable'}}},
      expectedResult: false,
    },
    {
      title: 'one cluster with tcp reachable',
      mockStorage: {x: {tcp: {result: 'reachable'}}},
      expectedResult: false,
    },
    {
      title: 'one cluster with xtls reachable',
      mockStorage: {x: {xtls: {result: 'reachable'}}, y: {xtls: {result: 'unreachable'}}},
      expectedResult: false,
    },
    {
      title: 'multiple clusters with various protocols reachable',
      mockStorage: {
        a: {udp: {result: 'reachable'}, tcp: {result: 'reachable'}},
        b: {udp: {result: 'unreachable'}, tcp: {result: 'reachable'}},
        c: {tcp: {result: 'reachable'}},
        d: {xtls: {result: 'reachable'}},
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with all protocols unreachable',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
      },
      expectedResult: true,
    },
    {
      title: 'multiple clusters with UDP and TCP protocols unreachable, but TLS not tested',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with UDP and TCP protocols unreachable, but TLS missing',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with UDP and TLS protocols unreachable, but TCP not tested',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'unreachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'unreachable'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with UDP and TLS protocols unreachable, but TCP missing',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with all protocols unreachable, some untested',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        b: {udp: {result: 'unreachable'}, tcp: {result: 'untested'}, xtls: {result: 'unreachable'}},
        c: {udp: {result: 'unreachable'}, tcp: {result: 'unreachable'}, xtls: {result: 'untested'}},
      },
      expectedResult: true,
    },
    {
      title: 'multiple clusters with all protocols unreachable, except for 1 reachable on udp',
      mockStorage: {
        a: {
          udp: {result: 'reachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with all protocols unreachable, except for 1 reachable on tcp',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'reachable'},
          xtls: {result: 'unreachable'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with all protocols unreachable, except for 1 reachable on xtls',
      mockStorage: {
        a: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
        b: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'reachable'},
        },
        c: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
        },
      },
      expectedResult: false,
    },
    {
      title: 'multiple clusters with some missing results',
      mockStorage: {
        a: {udp: {result: 'unreachable'}},
        b: {tcp: {result: 'unreachable'}},
        c: {xtls: {result: 'unreachable'}},
        d: {},
      },
      expectedResult: true,
    },
  ].forEach(({mockStorage, expectedResult, title}) => {
    it(`returns ${expectedResult} when ${title}`, async () => {
      await runCheck(mockStorage, expectedResult);
    });
  });
});

/**
 * helper class to mock ClusterReachability and allow to easily
 * simulate 'resultReady' events from it
 */
class MockClusterReachability extends EventEmitter {
  mockResult = {
    udp: {
      result: 'untested',
    },
    tcp: {
      result: 'untested',
    },
    xtls: {
      result: 'untested',
    },
  };

  isVideoMesh: boolean;
  name: string;

  constructor(name: string, clusterInfo: ClusterNode) {
    super();
    this.name = name;
    this.isVideoMesh = clusterInfo.isVideoMesh;
  }

  abort = sinon.stub();
  start = sinon.stub();

  getResult() {
    return this.mockResult;
  }

  /**
   * Emits a fake 'resultReady' event and makes sure that the same result
   * is returned when getResult() is called.
   *
   * @param protocol
   * @param result
   */
  public emitFakeResult(protocol, result) {
    this.mockResult[protocol] = result;
    this.emit(ClusterReachabilityModule.Events.resultReady, {protocol, ...result});
  }

  public emitFakeClientMediaIpUpdate(protocol, newIp) {
    this.mockResult[protocol].clientMediaIPs.push(newIp);
    this.emit(ClusterReachabilityModule.Events.clientMediaIpsUpdated, {
      protocol,
      clientMediaIPs: this.mockResult[protocol].clientMediaIPs,
    });
  }
}

describe('gatherReachability', () => {
  let webex;
  let clock;
  let clusterReachabilityCtorStub;
  let mockClusterReachabilityInstances: Record<string, MockClusterReachability>;

  beforeEach(async () => {
    webex = new MockWebex();

    sinon.stub(Metrics, 'sendBehavioralMetric');

    await webex.boundedStorage.put(
      'Reachability',
      'reachability.result',
      JSON.stringify({old: 'results'})
    );
    await webex.boundedStorage.put(
      'Reachability',
      'reachability.joinCookie',
      JSON.stringify({old: 'joinCookie'})
    );

    clock = sinon.useFakeTimers();

    mockClusterReachabilityInstances = {};

    clusterReachabilityCtorStub = sinon
      .stub(ClusterReachabilityModule, 'ClusterReachability')
      .callsFake((id, cluster) => {
        const mockInstance = new MockClusterReachability(id, cluster);

        mockClusterReachabilityInstances[id] = mockInstance;
        return mockInstance;
      });
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  // simulates time progression so that Reachability times out
  const simulateTimeout = async () => {
    await testUtils.flushPromises();
    clock.tick(3000);
  };

  const checkResults = async (expectedResults, expectedJoinCookie) => {
    const storedResultForReachabilityResult = await webex.boundedStorage.get(
      'Reachability',
      'reachability.result'
    );
    const storedResultForJoinCookie = await webex.boundedStorage.get(
      'Reachability',
      'reachability.joinCookie'
    );

    assert.equal(storedResultForReachabilityResult, JSON.stringify(expectedResults));
    assert.equal(storedResultForJoinCookie, JSON.stringify(expectedJoinCookie));
  };

  [
    // ========================================================================
    {
      title: '1 cluster with events triggered for each protocol',
      waitShortTimeout: false,
      waitLongTimeout: false,
      mockClusters: {
        cluster1: {
          udp: ['udp-url1'],
          tcp: ['tcp-url1'],
          xtls: ['xtls-url1'],
          isVideoMesh: false,
        },
      },
      mockResultReadyEvents: [
        {
          clusterId: 'cluster1',
          protocol: 'tcp',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 11,
          },
        },
        {
          clusterId: 'cluster1',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['1.2.3.4'],
            latencyInMilliseconds: 22,
          },
        },
        {
          clusterId: 'cluster1',
          protocol: 'xtls',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 33,
          },
        },
      ],
      expectedResults: {
        cluster1: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 22},
          tcp: {result: 'reachable', latencyInMilliseconds: 11},
          xtls: {result: 'reachable', latencyInMilliseconds: 33},
          isVideoMesh: false,
        },
      },
      expectedMetrics: {
        vmn_udp_min: -1,
        vmn_udp_max: -1,
        vmn_udp_average: -1,
        public_udp_min: 22,
        public_udp_max: 22,
        public_udp_average: 22,
        public_tcp_min: 11,
        public_tcp_max: 11,
        public_tcp_average: 11,
        public_xtls_min: 33,
        public_xtls_max: 33,
        public_xtls_average: 33,
      },
    },
    // ========================================================================
    {
      title:
        '3 clusters: one with an event for each protocol, one with no events, one with no urls for tcp and xtls',
      waitShortTimeout: 'public',
      waitLongTimeout: true,
      mockClusters: {
        cluster1: {
          udp: ['udp-url1.1', 'udp-url1.2'],
          tcp: ['tcp-url1.1', 'tcp-url1.2'],
          xtls: ['xtls-url1.1', 'xtls-url1.2'],
          isVideoMesh: false,
        },
        cluster2: {
          udp: ['udp-url2.1'],
          tcp: ['tcp-url2.1'],
          xtls: ['xtls-url2.1'],
          isVideoMesh: false,
        },
        cluster3: {
          udp: ['udp-url1'],
          tcp: [],
          xtls: [],
          isVideoMesh: true,
        },
      },
      mockResultReadyEvents: [
        {
          clusterId: 'cluster1',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['1.2.3.4'],
            latencyInMilliseconds: 13,
          },
        },
        {
          clusterId: 'cluster1',
          protocol: 'tcp',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 53,
          },
        },
        {
          clusterId: 'cluster1',
          protocol: 'xtls',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 113,
          },
        },
      ],
      expectedResults: {
        cluster1: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 13},
          tcp: {result: 'reachable', latencyInMilliseconds: 53},
          xtls: {result: 'reachable', latencyInMilliseconds: 113},
          isVideoMesh: false,
        },
        cluster2: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
        cluster3: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
      },
      expectedMetrics: {
        vmn_udp_min: -1,
        vmn_udp_max: -1,
        vmn_udp_average: -1,
        public_udp_min: 13,
        public_udp_max: 13,
        public_udp_average: 13,
        public_tcp_min: 53,
        public_tcp_max: 53,
        public_tcp_average: 53,
        public_xtls_min: 113,
        public_xtls_max: 113,
        public_xtls_average: 113,
      },
    },
    // ========================================================================
    {
      title: '3 clusters: all with all results ready in time for all protocols',
      waitShortTimeout: false,
      waitLongTimeout: false,
      mockClusters: {
        cluster1: {
          udp: ['udp-url1'],
          tcp: ['tcp-url1'],
          xtls: ['xtls-url1'],
          isVideoMesh: false,
        },
        cluster2: {
          udp: ['udp-url2'],
          tcp: ['tcp-url2'],
          xtls: ['xtls-url2'],
          isVideoMesh: false,
        },
        cluster3: {
          udp: ['udp-url3'],
          tcp: ['tcp-url3'],
          xtls: ['xtls-url3'],
          isVideoMesh: false,
        },
      },
      mockResultReadyEvents: [
        {
          clusterId: 'cluster1',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['1.2.3.4'],
            latencyInMilliseconds: 10,
          },
        },
        {
          clusterId: 'cluster1',
          protocol: 'tcp',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 100,
          },
        },
        {
          clusterId: 'cluster1',
          protocol: 'xtls',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 200,
          },
        },
        {
          clusterId: 'cluster2',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['1.2.3.4'],
            latencyInMilliseconds: 20,
          },
        },
        {
          clusterId: 'cluster2',
          protocol: 'tcp',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 110,
          },
        },
        {
          clusterId: 'cluster2',
          protocol: 'xtls',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 220,
          },
        },
        {
          clusterId: 'cluster3',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['1.2.3.4'],
            latencyInMilliseconds: 30,
          },
        },
        {
          clusterId: 'cluster3',
          protocol: 'tcp',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 120,
          },
        },
        {
          clusterId: 'cluster3',
          protocol: 'xtls',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 240,
          },
        },
      ],
      expectedResults: {
        cluster1: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 10},
          tcp: {result: 'reachable', latencyInMilliseconds: 100},
          xtls: {result: 'reachable', latencyInMilliseconds: 200},
          isVideoMesh: false,
        },
        cluster2: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 20},
          tcp: {result: 'reachable', latencyInMilliseconds: 110},
          xtls: {result: 'reachable', latencyInMilliseconds: 220},
          isVideoMesh: false,
        },
        cluster3: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 30},
          tcp: {result: 'reachable', latencyInMilliseconds: 120},
          xtls: {result: 'reachable', latencyInMilliseconds: 240},
          isVideoMesh: false,
        },
      },
      expectedMetrics: {
        vmn_udp_min: -1,
        vmn_udp_max: -1,
        vmn_udp_average: -1,
        public_udp_min: 10,
        public_udp_max: 30,
        public_udp_average: 20,
        public_tcp_min: 100,
        public_tcp_max: 120,
        public_tcp_average: 110,
        public_xtls_min: 200,
        public_xtls_max: 240,
        public_xtls_average: 220,
      },
    },
    // ========================================================================
    {
      title: '2 clusters: both with no results at all',
      waitShortTimeout: 'public',
      waitLongTimeout: true,
      mockClusters: {
        cluster1: {
          udp: ['udp-url1'],
          tcp: ['tcp-url1'],
          xtls: ['xtls-url1'],
          isVideoMesh: false,
        },
        cluster2: {
          udp: ['udp-url2'],
          tcp: ['tcp-url2'],
          xtls: ['xtls-url2'],
          isVideoMesh: false,
        },
      },
      mockResultReadyEvents: [],
      expectedResults: {
        cluster1: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
        cluster2: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
      },
      expectedMetrics: {
        vmn_udp_min: -1,
        vmn_udp_max: -1,
        vmn_udp_average: -1,
        public_udp_min: -1,
        public_udp_max: -1,
        public_udp_average: -1,
        public_tcp_min: -1,
        public_tcp_max: -1,
        public_tcp_average: -1,
        public_xtls_min: -1,
        public_xtls_max: -1,
        public_xtls_average: -1,
      },
    },
    // ========================================================================
    {
      title:
        '3 clusters: 2 VMN clusters missing results, but the public one has all results within 1s',
      waitShortTimeout: 'vmn',
      waitLongTimeout: true,
      mockClusters: {
        vmnCluster1: {
          udp: ['udp-url1'],
          tcp: ['tcp-url1'],
          xtls: ['xtls-url1'],
          isVideoMesh: true,
        },
        publicCluster: {
          udp: ['udp-url2'],
          tcp: ['tcp-url2'],
          xtls: ['xtls-url2'],
          isVideoMesh: false,
        },
        vmnCluster2: {
          udp: ['udp-url3'],
          tcp: ['tcp-url3'],
          xtls: ['xtls-url3'],
          isVideoMesh: true,
        },
      },
      mockResultReadyEvents: [
        {
          clusterId: 'publicCluster',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['1.2.3.4'],
            latencyInMilliseconds: 10,
          },
        },
        {
          clusterId: 'publicCluster',
          protocol: 'tcp',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 100,
          },
        },
        {
          clusterId: 'publicCluster',
          protocol: 'xtls',
          result: {
            result: 'reachable',
            latencyInMilliseconds: 200,
          },
        },
      ],
      expectedResults: {
        vmnCluster1: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        publicCluster: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 10},
          tcp: {result: 'reachable', latencyInMilliseconds: 100},
          xtls: {result: 'reachable', latencyInMilliseconds: 200},
          isVideoMesh: false,
        },
        vmnCluster2: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
      },
      expectedMetrics: {
        vmn_udp_min: -1,
        vmn_udp_max: -1,
        vmn_udp_average: -1,
        public_udp_min: 10,
        public_udp_max: 10,
        public_udp_average: 10,
        public_tcp_min: 100,
        public_tcp_max: 100,
        public_tcp_average: 100,
        public_xtls_min: 200,
        public_xtls_max: 200,
        public_xtls_average: 200,
      },
    },
    // ========================================================================
    {
      title: '2 VMN clusters with all results',
      waitShortTimeout: false,
      waitLongTimeout: false,
      mockClusters: {
        vmnCluster1: {
          udp: ['udp-url1'],
          tcp: [],
          xtls: [],
          isVideoMesh: true,
        },
        vmnCluster2: {
          udp: ['udp-url3'],
          tcp: [],
          xtls: [],
          isVideoMesh: true,
        },
      },
      mockResultReadyEvents: [
        {
          clusterId: 'vmnCluster1',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['192.168.10.1'],
            latencyInMilliseconds: 100,
          },
        },
        {
          clusterId: 'vmnCluster2',
          protocol: 'udp',
          result: {
            result: 'reachable',
            clientMediaIPs: ['192.168.0.1'],
            latencyInMilliseconds: 300,
          },
        },
      ],
      expectedResults: {
        vmnCluster1: {
          udp: {result: 'reachable', clientMediaIPs: ['192.168.10.1'], latencyInMilliseconds: 100},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        vmnCluster2: {
          udp: {result: 'reachable', clientMediaIPs: ['192.168.0.1'], latencyInMilliseconds: 300},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
      },
      expectedMetrics: {
        vmn_udp_min: 100,
        vmn_udp_max: 300,
        vmn_udp_average: 200,
        public_udp_min: -1,
        public_udp_max: -1,
        public_udp_average: -1,
        public_tcp_min: -1,
        public_tcp_max: -1,
        public_tcp_average: -1,
        public_xtls_min: -1,
        public_xtls_max: -1,
        public_xtls_average: -1,
      },
    },
  ].forEach(
    ({
      title,
      waitShortTimeout,
      waitLongTimeout,
      mockClusters,
      mockResultReadyEvents,
      expectedResults,
      expectedMetrics,
    }) =>
      it(`works correctly for the case: ${title}`, async () => {
        webex.config.meetings.experimental = {
          enableTcpReachability: true,
          enableTlsReachability: true,
        };

        const receivedEvents = {
          done: 0,
          firstResultAvailable: {
            udp: 0,
            tcp: 0,
            xtls: 0,
          },
        };

        const reachability = new Reachability(webex);

        reachability.on('reachability:done', () => {
          receivedEvents.done += 1;
        });
        reachability.on('reachability:firstResultAvailable', ({protocol}) => {
          receivedEvents.firstResultAvailable[protocol] += 1;
        });

        const mockGetClustersResult = {
          clusters: {},
          joinCookie: {id: 'id'},
        };

        Object.entries(mockClusters).forEach(([id, mockCluster]) => {
          mockGetClustersResult.clusters[id] = mockCluster;
        });

        reachability.reachabilityRequest.getClusters = sinon.stub().returns(mockGetClustersResult);

        const resultPromise = reachability.gatherReachability();

        await testUtils.flushPromises();

        // check that ClusterReachability instance was created for each cluster
        Object.entries(mockClusters).forEach(([id, mockCluster]) => {
          assert.calledWith(clusterReachabilityCtorStub, id, mockCluster);
        });

        // trigger mock result events from ClusterReachability instances
        mockResultReadyEvents.forEach((mockEvent) => {
          mockClusterReachabilityInstances[mockEvent.clusterId].emitFakeResult(
            mockEvent.protocol,
            mockEvent.result
          );
        });

        if (waitShortTimeout === 'public') {
          clock.tick(3000);
        }
        if (waitShortTimeout === 'vmn') {
          clock.tick(1000);
        }

        await resultPromise;

        await checkResults(expectedResults, mockGetClustersResult.joinCookie);

        if (waitLongTimeout) {
          // we need to wait either 14 or 12 seconds to get to the 15s timeout (depending on how much we waited earlier)
          clock.tick(waitShortTimeout === 'vmn' ? 14000 : 12000);

          // we check the results again after the long timeout - they should be the same
          await checkResults(expectedResults, mockGetClustersResult.joinCookie);
        }

        // now check events emitted by Reachability class
        assert.equal(receivedEvents['done'], 1);

        // if we've mocked at least one event for any protocol, check that we received
        // firstResultAvailable event for that protocol
        if (mockResultReadyEvents.filter((event) => event.protocol === 'udp').length > 0) {
          assert.equal(receivedEvents['firstResultAvailable']['udp'], 1);
        }
        if (mockResultReadyEvents.filter((event) => event.protocol === 'tcp').length > 0) {
          assert.equal(receivedEvents['firstResultAvailable']['tcp'], 1);
        }
        if (mockResultReadyEvents.filter((event) => event.protocol === 'xtls').length > 0) {
          assert.equal(receivedEvents['firstResultAvailable']['xtls'], 1);
        }

        // finally, check the metrics
        assert.calledWith(
          Metrics.sendBehavioralMetric,
          'js_sdk_reachability_completed',
          expectedMetrics
        );
      })
  );

  it('keeps updating reachability results after the 3s public cloud timeout expires', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: true,
      enableTlsReachability: true,
    };

    const reachability = new Reachability(webex);

    const mockGetClustersResult = {
      clusters: {
        clusterA: {
          udp: ['udp-urlA'],
          tcp: ['tcp-urlA'],
          xtls: ['xtls-urlA'],
          isVideoMesh: false,
        },
        clusterB: {
          udp: ['udp-urlB'],
          tcp: ['tcp-urlB'],
          xtls: ['xtls-urlB'],
          isVideoMesh: false,
        },
      },
      joinCookie: {id: 'id'},
    };

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(mockGetClustersResult);

    const resultPromise = reachability.gatherReachability();

    await testUtils.flushPromises();

    // trigger some mock result events from ClusterReachability instances
    mockClusterReachabilityInstances['clusterA'].emitFakeResult('udp', {
      result: 'reachable',
      clientMediaIPs: ['1.2.3.4'],
      latencyInMilliseconds: 11,
    });
    mockClusterReachabilityInstances['clusterB'].emitFakeResult('udp', {
      result: 'reachable',
      clientMediaIPs: ['10.20.30.40'],
      latencyInMilliseconds: 22,
    });

    clock.tick(3000);
    await resultPromise;

    // check that the reachability results contain the 2 results from above
    await checkResults(
      {
        clusterA: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 11},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
        clusterB: {
          udp: {result: 'reachable', clientMediaIPs: ['10.20.30.40'], latencyInMilliseconds: 22},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
      },
      mockGetClustersResult.joinCookie
    );

    // now simulate some more "late" results
    mockClusterReachabilityInstances['clusterA'].emitFakeResult('tcp', {
      result: 'reachable',
      latencyInMilliseconds: 101,
    });
    mockClusterReachabilityInstances['clusterB'].emitFakeResult('xtls', {
      result: 'reachable',
      latencyInMilliseconds: 102,
    });

    // and wait for the final overall timeout
    clock.tick(12000);

    // the reachability results should include all results from above (including the late ones)
    await checkResults(
      {
        clusterA: {
          udp: {result: 'reachable', clientMediaIPs: ['1.2.3.4'], latencyInMilliseconds: 11},
          tcp: {result: 'reachable', latencyInMilliseconds: 101},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
        clusterB: {
          udp: {result: 'reachable', clientMediaIPs: ['10.20.30.40'], latencyInMilliseconds: 22},
          tcp: {result: 'unreachable'},
          xtls: {result: 'reachable', latencyInMilliseconds: 102},
          isVideoMesh: false,
        },
      },
      mockGetClustersResult.joinCookie
    );
  });

  it('handles clientMediaIpsUpdated event by updating clientMediaIps in results', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: true,
      enableTlsReachability: true,
    };

    const reachability = new Reachability(webex);

    const mockGetClustersResult = {
      clusters: {
        clusterA: {
          udp: ['udp-urlA'],
          tcp: ['tcp-urlA'],
          xtls: ['xtls-urlA'],
          isVideoMesh: false,
        },
      },
      joinCookie: {id: 'id'},
    };

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(mockGetClustersResult);

    const resultPromise = reachability.gatherReachability();

    await testUtils.flushPromises();

    // trigger a mock result event
    mockClusterReachabilityInstances['clusterA'].emitFakeResult('udp', {
      result: 'reachable',
      clientMediaIPs: ['64.103.40.20'],
      latencyInMilliseconds: 11,
    });
    // followed by some updates to client media IPs
    mockClusterReachabilityInstances['clusterA'].emitFakeClientMediaIpUpdate('udp', '64.103.40.21');
    mockClusterReachabilityInstances['clusterA'].emitFakeClientMediaIpUpdate('udp', '64.103.40.22');

    // wait for the final overall timeout
    clock.tick(15000);
    await resultPromise;

    // check that the reachability results contain all the client media ips
    await checkResults(
      {
        clusterA: {
          udp: {
            result: 'reachable',
            clientMediaIPs: ['64.103.40.20', '64.103.40.21', '64.103.40.22'],
            latencyInMilliseconds: 11,
          },
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: false,
        },
      },
      mockGetClustersResult.joinCookie
    );
  });

  it('keeps the stored reachability from previous call to gatherReachability if getClusters fails', async () => {
    const reachability = new Reachability(webex);

    reachability.reachabilityRequest.getClusters = sinon.stub().throws();

    const result = await reachability.gatherReachability();

    assert.empty(result);

    await checkResults({old: 'results'}, {old: 'joinCookie'});
  });

  it('keeps the stored reachability from previous call to gatherReachability if performReachabilityChecks fails', async () => {
    const reachability = new Reachability(webex);

    const getClustersResult = {
      clusters: {clusterId: 'cluster'},
      joinCookie: {id: 'cookie id'},
    };

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(getClustersResult);
    (reachability as any).performReachabilityChecks = sinon.stub().throws();

    const result = await reachability.gatherReachability();

    assert.empty(result);

    await checkResults({old: 'results'}, {id: 'cookie id'});
  });

  it('starts ClusterReachability on each media cluster', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: true,
      enableTlsReachability: true,
    };

    const getClustersResult = {
      clusters: {
        'cluster 1': {
          udp: ['udp1.1', 'udp1.2'],
          tcp: ['tcp1.1', 'tcp1.2'],
          xtls: ['xtls1.1', 'xtls1.2'],
          isVideoMesh: false,
        },
        'cluster 2': {
          udp: ['udp2.1', 'udp2.2'],
          tcp: ['tcp2.1', 'tcp2.2'],
          xtls: ['xtls2.1', 'xtls2.2'],
          isVideoMesh: true,
        },
      },
      joinCookie: {id: 'id'},
    };

    const reachability = new Reachability(webex);

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(getClustersResult);

    const promise = reachability.gatherReachability();

    await simulateTimeout();
    await promise;

    assert.calledTwice(clusterReachabilityCtorStub);
    assert.calledWith(clusterReachabilityCtorStub, 'cluster 1', {
      udp: ['udp1.1', 'udp1.2'],
      tcp: ['tcp1.1', 'tcp1.2'],
      xtls: ['xtls1.1', 'xtls1.2'],
      isVideoMesh: false,
    });
    // cluster 2 is video mesh, so we should not do TCP or TLS reachability on it
    assert.calledWith(clusterReachabilityCtorStub, 'cluster 2', {
      udp: ['udp2.1', 'udp2.2'],
      tcp: [],
      xtls: [],
      isVideoMesh: true,
    });

    assert.calledOnce(mockClusterReachabilityInstances['cluster 1'].start);
    assert.calledOnce(mockClusterReachabilityInstances['cluster 2'].start);
  });

  it('does not do TCP reachability if it is disabled in config', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: false,
      enableTlsReachability: true,
    };

    const getClustersResult = {
      clusters: {
        'cluster name': {
          udp: ['testUDP1', 'testUDP2'],
          tcp: ['testTCP1', 'testTCP2'],
          xtls: ['testXTLS1', 'testXTLS2'],
          isVideoMesh: false,
        },
      },
      joinCookie: {id: 'id'},
    };

    const reachability = new Reachability(webex);

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(getClustersResult);

    const promise = reachability.gatherReachability();
    await simulateTimeout();
    await promise;

    assert.calledOnceWithExactly(clusterReachabilityCtorStub, 'cluster name', {
      isVideoMesh: false,
      udp: ['testUDP1', 'testUDP2'],
      tcp: [], // empty list because TCP is disabled in config
      xtls: ['testXTLS1', 'testXTLS2'],
    });
  });

  it('does not do TLS reachability if it is disabled in config', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: true,
      enableTlsReachability: false,
    };

    const getClustersResult = {
      clusters: {
        'cluster name': {
          udp: ['testUDP1', 'testUDP2'],
          tcp: ['testTCP1', 'testTCP2'],
          xtls: ['testXTLS1', 'testXTLS2'],
          isVideoMesh: false,
        },
      },
      joinCookie: {id: 'id'},
    };

    const reachability = new Reachability(webex);

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(getClustersResult);

    const promise = reachability.gatherReachability();

    await simulateTimeout();
    await promise;

    assert.calledOnceWithExactly(clusterReachabilityCtorStub, 'cluster name', {
      isVideoMesh: false,
      udp: ['testUDP1', 'testUDP2'],
      tcp: ['testTCP1', 'testTCP2'],
      xtls: [], // empty list because TLS is disabled in config
    });
  });

  it('does not do TCP or TLS reachability if it is disabled in config', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: false,
      enableTlsReachability: false,
    };

    const getClustersResult = {
      clusters: {
        'cluster name': {
          udp: ['testUDP1', 'testUDP2'],
          tcp: ['testTCP1', 'testTCP2'],
          xtls: ['testXTLS1', 'testXTLS2'],
          isVideoMesh: false,
        },
      },
      joinCookie: {id: 'id'},
    };

    const reachability = new Reachability(webex);

    reachability.reachabilityRequest.getClusters = sinon.stub().returns(getClustersResult);

    const promise = reachability.gatherReachability();

    await simulateTimeout();
    await promise;

    assert.calledOnceWithExactly(clusterReachabilityCtorStub, 'cluster name', {
      isVideoMesh: false,
      udp: ['testUDP1', 'testUDP2'],
      tcp: [], // empty list because TCP is disabled in config
      xtls: [], // empty list because TLS is disabled in config
    });
  });

  it('retry of getClusters is succesfull', async () => {
    webex.config.meetings.experimental = {
      enableTcpReachability: true,
      enableTlsReachability: false,
    };

    const getClustersResult = {
      clusters: {
        'cluster name': {
          udp: ['testUDP1', 'testUDP2'],
          tcp: ['testTCP1', 'testTCP2'],
          xtls: ['testXTLS1', 'testXTLS2'],
          isVideoMesh: false,
        },
      },
      joinCookie: {id: 'id'},
    };

    const reachability = new Reachability(webex);

    let getClustersCallCount = 0;
    
    reachability.reachabilityRequest.getClusters = sinon.stub().callsFake(() => {
      getClustersCallCount++;

      if (getClustersCallCount == 1) {
        throw new Error('fake error');
      }
      
      return getClustersResult;
    });

    const promise = reachability.gatherReachability();

    await simulateTimeout();
    await promise;
    
    assert.equal(getClustersCallCount, 2);

    assert.calledOnce(clusterReachabilityCtorStub);
  });

  it('two failed calls to getClusters', async () => {
    const reachability = new Reachability(webex);

    let getClustersCallCount = 0;
    
    reachability.reachabilityRequest.getClusters = sinon.stub().callsFake(() => {
      getClustersCallCount++;

      throw new Error('fake error');
    });

    const promise = reachability.gatherReachability();

    await simulateTimeout();
    
    await promise;
    
    assert.equal(getClustersCallCount, 2);

    assert.neverCalledWith(clusterReachabilityCtorStub);
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

  const runCheck = async (mockStorage: any, expectedResult: ReachabilityResultsForBackend) => {
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

  it('returns results from local storage, converted to the backend data format', async () => {
    await runCheck(
      // mock storage:
      {
        cluster1: {
          udp: {result: 'reachable', latencyInMilliseconds: 100},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
        },
        cluster2: {
          udp: {result: 'reachable', latencyInMilliseconds: 200},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        cluster3: {
          udp: {result: 'unreachable'},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'untested'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        cluster4: {
          udp: {result: 'reachable', latencyInMilliseconds: 300},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          someOtherField: 'any value',
        },
      },
      // expected result (same as above, but with values converted and isVideoMesh and someOtherField stripped out):
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
          udp: {reachable: 'true', latencyInMilliseconds: '300'},
          tcp: {untested: 'true'},
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
      reachability_public_xtls_success: 0,
      reachability_public_xtls_failed: 0,
      reachability_vmn_udp_success: 0,
      reachability_vmn_udp_failed: 0,
      reachability_vmn_tcp_success: 0,
      reachability_vmn_tcp_failed: 0,
      reachability_vmn_xtls_success: 0,
      reachability_vmn_xtls_failed: 0,
    });
  });

  it('returns correct stats based on local storage results', async () => {
    await runCheck(
      // mock storage:
      {
        public1: {
          udp: {result: 'reachable', latencyInMilliseconds: 100},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
        },
        vmn1: {
          udp: {result: 'reachable', latencyInMilliseconds: 200},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        vmn2: {
          udp: {result: 'untested'},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'untested'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        public2: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          someOtherField: 'any value',
        },
        public3: {
          udp: {result: 'reachable', latencyInMilliseconds: 400, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'untested'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public4: {
          udp: {result: 'reachable', latencyInMilliseconds: 40, clientMediaIPs: ['10.10.10.11']},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.11']},
          xtls: {result: 'untested'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public5: {
          udp: {result: 'unreachable'},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
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
        reachability_public_xtls_success: 0,
        reachability_public_xtls_failed: 0,
        reachability_vmn_udp_success: 1,
        reachability_vmn_udp_failed: 0,
        reachability_vmn_tcp_success: 1,
        reachability_vmn_tcp_failed: 1,
        reachability_vmn_xtls_success: 0,
        reachability_vmn_xtls_failed: 0,
      }
    );
  });

  it('returns correct stats when only public nodes were tested', async () => {
    await runCheck(
      // mock storage:
      {
        public1: {
          udp: {result: 'reachable', latencyInMilliseconds: 400, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'untested'},
          isVideoMesh: false,
        },
        public2: {
          udp: {result: 'reachable', latencyInMilliseconds: 100},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
        },
        public3: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          someOtherField: 'any value',
        },
        public4: {
          udp: {result: 'untested'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public5: {
          udp: {result: 'reachable', latencyInMilliseconds: '400', clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'untested'},
          xtls: {result: 'unreachable'},
        },
        public6: {
          udp: {result: 'untested'},
          tcp: {result: 'untested'},
          xtls: {
            result: 'reachable',
            latencyInMilliseconds: '200',
            clientMediaIPs: ['10.10.10.10'],
          },
        },
      },
      // expected result:
      {
        reachability_public_udp_success: 3,
        reachability_public_udp_failed: 1,
        reachability_public_tcp_success: 1,
        reachability_public_tcp_failed: 2,
        reachability_public_xtls_success: 1,
        reachability_public_xtls_failed: 1,
        reachability_vmn_udp_success: 0,
        reachability_vmn_udp_failed: 0,
        reachability_vmn_tcp_success: 0,
        reachability_vmn_tcp_failed: 0,
        reachability_vmn_xtls_success: 0,
        reachability_vmn_xtls_failed: 0,
      }
    );
  });

  it('returns correct stats when only video mesh nodes were tested', async () => {
    await runCheck(
      // mock storage:
      {
        vmn1: {
          udp: {result: 'unreachable'},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        vmn2: {
          udp: {result: 'reachable', latencyInMilliseconds: 200, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'untested'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        vmn3: {
          udp: {result: 'reachable', latencyInMilliseconds: 300, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
        },
        vmn4: {
          udp: {result: 'untested'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        vmn5: {
          udp: {result: 'reachable', latencyInMilliseconds: 200, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'unreachable'},
          xtls: {result: 'unreachable'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        vmn6: {
          udp: {result: 'untested'},
          tcp: {result: 'untested'},
          xtls: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          isVideoMesh: true,
        },
      },
      // expected result:
      {
        reachability_public_udp_success: 0,
        reachability_public_udp_failed: 0,
        reachability_public_tcp_success: 0,
        reachability_public_tcp_failed: 0,
        reachability_public_xtls_success: 0,
        reachability_public_xtls_failed: 0,
        reachability_vmn_udp_success: 3,
        reachability_vmn_udp_failed: 1,
        reachability_vmn_tcp_success: 1,
        reachability_vmn_tcp_failed: 3,
        reachability_vmn_xtls_success: 1,
        reachability_vmn_xtls_failed: 1,
      }
    );
  });
});

class TestReachability extends Reachability {
  constructor(webex: object) {
    super(webex);
  }

  public testGetStatistics(
    results: Array<ClusterReachabilityModule.ClusterReachabilityResult & {isVideoMesh: boolean}>,
    protocol: 'udp' | 'tcp' | 'xtls',
    isVideoMesh: boolean
  ) {
    return this.getStatistics(results, protocol, isVideoMesh);
  }

  public testSendMetric() {
    return this.sendMetric();
  }

  public setFakeClusterReachability(fakeClusterReachability) {
    this.clusterReachability = fakeClusterReachability;
  }
}

describe('getStatistics', () => {
  let webex;
  let reachability;

  beforeEach(() => {
    webex = new MockWebex();
    reachability = new TestReachability(webex);
  });

  it('takes values from the correct protocol', () => {
    const results = [
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
        },
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 1010,
        },
        xtls: {
          result: 'reachable',
          latencyInMilliseconds: 2010,
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 20,
        },
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 1020,
        },
        xtls: {
          result: 'reachable',
          latencyInMilliseconds: 2020,
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 30,
        },
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 1030,
        },
        xtls: {
          result: 'reachable',
          latencyInMilliseconds: 2030,
        },
        isVideoMesh: false,
      },
    ];

    assert.deepEqual(reachability.testGetStatistics(results, 'udp', false), {
      min: 10,
      max: 30,
      average: 20,
    });
    assert.deepEqual(reachability.testGetStatistics(results, 'tcp', false), {
      min: 1010,
      max: 1030,
      average: 1020,
    });
    assert.deepEqual(reachability.testGetStatistics(results, 'xtls', false), {
      min: 2010,
      max: 2030,
      average: 2020,
    });
  });

  it('filters based on isVideoMesh value', () => {
    const results = [
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
        },
        isVideoMesh: true,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 20,
        },
        isVideoMesh: true,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 30,
        },
        isVideoMesh: true,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 100,
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 200,
        },
        isVideoMesh: false,
      },
    ];

    assert.deepEqual(reachability.testGetStatistics(results, 'udp', true), {
      min: 10,
      max: 30,
      average: 20,
    });
    assert.deepEqual(reachability.testGetStatistics(results, 'udp', false), {
      min: 100,
      max: 200,
      average: 150,
    });
  });

  it('only takes into account "reachable" results', () => {
    const results = [
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'unreachable',
          latencyInMilliseconds: 100, // value put in here just for testing, in practice we wouldn't have any value here if it was unreachable
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 20,
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'untested',
          latencyInMilliseconds: 200, // value put in here just for testing, in practice we wouldn't have any value here if it was untested
        },
        isVideoMesh: false,
      },
    ];

    assert.deepEqual(reachability.testGetStatistics(results, 'udp', false), {
      min: 10,
      max: 20,
      average: 15,
    });
  });

  it('handles the case when results are empty', () => {
    assert.deepEqual(reachability.testGetStatistics([], 'udp', false), {
      min: -1,
      max: -1,
      average: -1,
    });
  });

  it('handles the case when results are empty after filtering', () => {
    const fakeResults = [
      {
        udp: {
          result: 'untested', // it will get filtered out because of this value
          latencyInMilliseconds: 10,
        },
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 10, // it will get filtered out because of the tcp protocol
        },
        isVideoMesh: false,
      },
      {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
        },
        isVideoMesh: true, // it will get filtered out because of this value
      },
    ];

    assert.deepEqual(reachability.testGetStatistics(fakeResults, 'udp', false), {
      min: -1,
      max: -1,
      average: -1,
    });
  });
});

describe('sendMetric', () => {
  let webex;
  let reachability;

  beforeEach(() => {
    webex = new MockWebex();
    reachability = new TestReachability(webex);

    sinon.stub(Metrics, 'sendBehavioralMetric');
  });

  it('works as expected', async () => {
    // setup stub for getStatistics to return values that show what parameters it was called with,
    // this way we can verify that the correct results of calls to getStatistics are placed
    // in correct data fields when sendBehavioralMetric() is called
    const getStatisticsStub = sinon
      .stub(reachability, 'getStatistics')
      .callsFake((results, protocol, isVideoMesh) => {
        return {result: 'fake', protocol, isVideoMesh};
      });

    // setup fake clusterReachability results
    reachability.setFakeClusterReachability({
      cluster1: {
        getResult: sinon.stub().returns({result: 'result 1'}),
        isVideoMesh: true,
      },
      cluster2: {
        getResult: sinon.stub().returns({result: 'result 2'}),
        isVideoMesh: false,
      },
      cluster3: {
        getResult: sinon.stub().returns({result: 'result 3'}),
        isVideoMesh: false,
      },
    });

    await reachability.sendMetric();

    // each call to getStatistics should be made with all the results from all fake clusterReachability:
    const expectedResults = [
      {
        result: 'result 1',
        isVideoMesh: true,
      },
      {
        result: 'result 2',
        isVideoMesh: false,
      },
      {
        result: 'result 3',
        isVideoMesh: false,
      },
    ];

    // check that getStatistics is called 4 times and each time with all the results
    assert.callCount(getStatisticsStub, 4);
    assert.alwaysCalledWith(getStatisticsStub, expectedResults, sinon.match.any, sinon.match.any);

    assert.calledWith(Metrics.sendBehavioralMetric, 'js_sdk_reachability_completed', {
      vmn_udp_result: 'fake',
      vmn_udp_protocol: 'udp',
      vmn_udp_isVideoMesh: true,

      public_udp_result: 'fake',
      public_udp_protocol: 'udp',
      public_udp_isVideoMesh: false,

      public_tcp_result: 'fake',
      public_tcp_protocol: 'tcp',
      public_tcp_isVideoMesh: false,

      public_xtls_result: 'fake',
      public_xtls_protocol: 'xtls',
      public_xtls_isVideoMesh: false,
    });
  });
});
