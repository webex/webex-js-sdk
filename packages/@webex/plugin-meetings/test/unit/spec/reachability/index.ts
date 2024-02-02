import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Reachability, {ReachabilityResults, ReachabilityResultsForBackend} from '@webex/plugin-meetings/src/reachability/';
import MeetingUtil from '@webex/plugin-meetings/src/meeting/util';
import * as ClusterReachabilityModule from '@webex/plugin-meetings/src/reachability/clusterReachability';

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
    await checkIsClusterReachable({x: {udp: {result: 'reachable'}, tcp: {result: 'unreachable'}}}, true);
  });

  it('returns true when tcp is reachable', async () => {
    await checkIsClusterReachable({x: {udp: {result: 'unreachable'}, tcp: {result: 'reachable'}}}, true);
  });

  it('returns true when both tcp and udp are reachable', async () => {
    await checkIsClusterReachable({x: {udp: {result: 'reachable'}, tcp: {result: 'reachable'}}}, true);
  });

  it('returns false when both tcp and udp are unreachable', async () => {
    await checkIsClusterReachable({x: {udp: {result: 'unreachable'}, tcp: {result: 'unreachable'}}}, false);
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
          udp: {result: 'reachable'},
          tcp: {result: 'reachable'},
          isVideoMesh: true,
        },
        y: {
          udp: {result: 'unreachable'},
          tcp: {result: 'reachable'},
          isVideoMesh: true,
        }
      }, false);
    });

    it('returns false if there public cluster reachability failed, only video mesh succeeded', async () => {
      await checkIsClusterReachable({
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
        }
      }, false);
    });

    it('returns true if there is at least 1 public cluster result, while video mesh is not reachable', async () => {
      await checkIsClusterReachable({
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

  afterEach(() => {
    sinon.restore();
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
    (reachability as any).performReachabilityChecks = sinon.stub().returns(reachabilityResults);

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

  it('starts ClusterReachability on each media cluster', async () => {
    webex.config.meetings.experimental = {enableTcpReachability: true};

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

    const startStub = sinon.stub().resolves({});
    const clusterReachabilityCtorStub = sinon
      .stub(ClusterReachabilityModule, 'ClusterReachability')
      .callsFake(() => ({
        start: startStub,
      }));

    await reachability.gatherReachability();

    assert.calledTwice(clusterReachabilityCtorStub);
    assert.calledWith(clusterReachabilityCtorStub, 'cluster 1', {
      udp: ['udp1.1', 'udp1.2'],
      tcp: ['tcp1.1', 'tcp1.2'],
      xtls: ['xtls1.1', 'xtls1.2'],
      isVideoMesh: false,
    });
    assert.calledWith(clusterReachabilityCtorStub, 'cluster 2', {
      udp: ['udp2.1', 'udp2.2'],
      tcp: ['tcp2.1', 'tcp2.2'],
      xtls: ['xtls2.1', 'xtls2.2'],
      isVideoMesh: true,
    });

    assert.calledTwice(startStub);
  });

  it('does not do TCP reachability if it is disabled in config', async () => {
    webex.config.meetings.experimental = {enableTcpReachability: false};

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

    const clusterReachabilityCtorStub = sinon
      .stub(ClusterReachabilityModule, 'ClusterReachability')
      .callsFake(() => ({
        start: sinon.stub().resolves({}),
      }));

    await reachability.gatherReachability();

    assert.calledOnceWithExactly(clusterReachabilityCtorStub, 'cluster name', {
      isVideoMesh: false,
      udp: ['testUDP1', 'testUDP2'],
      tcp: [], // empty list because TCP is disabled in config
      xtls: ['testXTLS1', 'testXTLS2'],
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
          xtls: {result: 'not tested'},
        },
        cluster2: {
          udp: {result: 'reachable', latencyInMilliseconds: 200},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
        },
        cluster3: {
          udp: {result: 'unreachable'},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        cluster4: {
          udp: {result: 'reachable', latencyInMilliseconds: 300},
          tcp: {result: 'not tested'},
          xtls: {result: 'not tested'},
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
          udp: {result: 'reachable', latencyInMilliseconds: 100},
          tcp: {result: 'not tested'},
          xtls: {result: 'not tested'},
        },
        vmn1: {
          udp: {result: 'reachable', latencyInMilliseconds: 200},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
        },
        vmn2: {
          udp: {result: 'not tested'},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        public2: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          someOtherField: 'any value',
        },
        public3: {
          udp: {result: 'reachable', latencyInMilliseconds: 400, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'not tested'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public4: {
          udp: {result: 'reachable', latencyInMilliseconds: 40, clientMediaIPs: ['10.10.10.11']},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.11']},
          xtls: {result: 'not tested'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public5: {
          udp: {result: 'unreachable'},
          tcp: {result: 'not tested'},
          xtls: {result: 'not tested'},
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
          udp: {result: 'reachable', latencyInMilliseconds: 400, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'not tested'},
          isVideoMesh: false,
        },
        public2: {
          udp: {result: 'reachable', latencyInMilliseconds: 100},
          tcp: {result: 'not tested'},
          xtls: {result: 'not tested'},
        },
        public3: {
          udp: {result: 'unreachable'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          someOtherField: 'any value',
        },
        public4: {
          udp: {result: 'not tested'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          isVideoMesh: false,
          someOtherField: 'any value',
        },
        public5: {
          udp: {result: 'reachable', latencyInMilliseconds: '400', clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'not tested'},
          xtls: {result: 'not tested'},
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
          udp: {result: 'unreachable'},
          tcp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['10.10.10.10']},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
        },
        vmn2: {
          udp: {result: 'reachable', latencyInMilliseconds: 200, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'not tested'},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
        },
        vmn3: {
          udp: {result: 'reachable', latencyInMilliseconds: 300, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
        },
        vmn4: {
          udp: {result: 'not tested'},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
          isVideoMesh: true,
          someOtherField: 'any value',
        },
        vmn5: {
          udp: {result: 'reachable', latencyInMilliseconds: 200, clientMediaIPs: ['10.10.10.10']},
          tcp: {result: 'unreachable'},
          xtls: {result: 'not tested'},
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