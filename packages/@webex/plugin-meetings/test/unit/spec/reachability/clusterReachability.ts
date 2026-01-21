import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import testUtils from '../../../utils/testUtils';

import {
  ClusterReachability,
  ResultEventData,
  Events,
  ClientMediaIpsUpdatedEventData,
  NatTypeUpdatedEventData,
} from '@webex/plugin-meetings/src/reachability/clusterReachability';
import {ReachabilityPeerConnection} from '@webex/plugin-meetings/src/reachability/reachabilityPeerConnection';
import {ReachabilityPeerConnectionEvents} from '@webex/plugin-meetings/src/reachability/reachability.types';

// Type for accessing private properties of ClusterReachability in tests
type ClusterReachabilityPrivate = {
  reachabilityPeerConnectionsForUdp: ReachabilityPeerConnection[];
  reachabilityPeerConnectionsForTcp: ReachabilityPeerConnection[];
  reachabilityPeerConnectionsForXtls: ReachabilityPeerConnection[];
  reachabilityPeerConnection: ReachabilityPeerConnection | null;
};

describe('ClusterReachability', () => {
  let previousRTCPeerConnection;
  let clusterReachability;
  let fakePeerConnection;
  let gatherIceCandidatesSpy;

  const emittedEvents: Record<
    Events,
    (ResultEventData | ClientMediaIpsUpdatedEventData | NatTypeUpdatedEventData)[]
  > = {
    [Events.resultReady]: [],
    [Events.clientMediaIpsUpdated]: [],
    [Events.natTypeUpdated]: [],
  };
  const FAKE_OFFER = {type: 'offer', sdp: 'fake sdp'};

  const resetEmittedEvents = () => {
    emittedEvents[Events.resultReady].length = 0;
    emittedEvents[Events.clientMediaIpsUpdated].length = 0;
    emittedEvents[Events.natTypeUpdated].length = 0;
  };
  beforeEach(() => {
    fakePeerConnection = {
      createOffer: sinon.stub().resolves(FAKE_OFFER),
      setLocalDescription: sinon.stub().resolves(),
      close: sinon.stub(),
      iceGatheringState: 'new',
    };

    previousRTCPeerConnection = global.RTCPeerConnection;
    global.RTCPeerConnection = sinon.stub().returns(fakePeerConnection);

    clusterReachability = new ClusterReachability('testName', {
      isVideoMesh: false,
      udp: ['stun:udp1', 'stun:udp2'],
      tcp: ['stun:tcp1.webex.com', 'stun:tcp2.webex.com:5004'],
      xtls: ['stun:xtls1.webex.com', 'stun:xtls2.webex.com:443'],
    });

    gatherIceCandidatesSpy = sinon.spy(
      (clusterReachability as unknown as ClusterReachabilityPrivate)
        .reachabilityPeerConnection as any,
      'gatherIceCandidates'
    );

    resetEmittedEvents();

    clusterReachability.on(Events.resultReady, (data: ResultEventData) => {
      emittedEvents[Events.resultReady].push(data);
    });

    clusterReachability.on(Events.clientMediaIpsUpdated, (data: ClientMediaIpsUpdatedEventData) => {
      emittedEvents[Events.clientMediaIpsUpdated].push(data);
    });

    clusterReachability.on(Events.natTypeUpdated, (data: NatTypeUpdatedEventData) => {
      emittedEvents[Events.natTypeUpdated].push(data);
    });
  });

  afterEach(() => {
    global.RTCPeerConnection = previousRTCPeerConnection;
  });

  it('should create an instance correctly with provided cluster info', () => {
    assert.instanceOf(clusterReachability, ClusterReachability);
    assert.equal(clusterReachability.name, 'testName');
    assert.equal(clusterReachability.isVideoMesh, false);
    assert.instanceOf(clusterReachability.reachabilityPeerConnection, ReachabilityPeerConnection);
  });

  it('should initialize reachedSubnets as empty set', () => {
    assert.instanceOf(clusterReachability.reachedSubnets, Set);
    assert.equal(clusterReachability.reachedSubnets.size, 0);
  });

  it('returns correct results before start() is called', () => {
    const result = clusterReachability.getResult();
    assert.equal(result.udp.result, 'untested');
    assert.equal(result.tcp.result, 'untested');
    assert.equal(result.xtls.result, 'untested');
    // details are empty arrays when URLs don't contain IP addresses
    assert.deepEqual(result.udp.details, []);
    assert.deepEqual(result.tcp.details, []);
    assert.deepEqual(result.xtls.details, []);

    // verify that no events were emitted
    assert.deepEqual(emittedEvents[Events.resultReady], []);
    assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);
  });

  it('should create separate peer connections when enablePerUdpUrlReachability is true', () => {
    const perUdpClusterReachability = new ClusterReachability(
      'testName',
      {
        isVideoMesh: false,
        udp: ['stun:udp1', 'stun:udp2'],
        tcp: ['stun:tcp1.webex.com'],
        xtls: ['stun:xtls1.webex.com'],
      },
      true
    );

    const instance = perUdpClusterReachability as unknown as ClusterReachabilityPrivate;
    assert.equal(instance.reachabilityPeerConnectionsForUdp.length, 2);
    assert.instanceOf(instance.reachabilityPeerConnection, ReachabilityPeerConnection);
  });

  describe('#event relaying', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('relays resultReady event from ReachabilityPeerConnection', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      // Simulate RPC emitting resultReady
      await clock.tickAsync(50);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // Add relay candidates to satisfy TCP and XTLS requirements so they emit reachable instead of unreachable
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'relayIp'}});
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'relayIp', port: 443},
      });

      // Complete ICE gathering to trigger resultReady emission
      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();

      // ClusterReachability should relay events for all 3 protocols
      assert.equal(emittedEvents[Events.resultReady].length, 3);
      const udpEvent = emittedEvents[Events.resultReady].find((e) => e.protocol === 'udp');
      assert.equal(udpEvent.protocol, 'udp');
      assert.equal(udpEvent.result, 'reachable');
      assert.equal(udpEvent.latencyInMilliseconds, 50);
      assert.deepEqual(udpEvent.clientMediaIPs, ['somePublicIp1']);

      await promise;
    });

    it('relays clientMediaIpsUpdated event from ReachabilityPeerConnection', async () => {
      const promise = clusterReachability.start();

      // Candidates must be added BEFORE ICE gathering completes to get multiple resultReady events
      // or clientMediaIpsUpdated events
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // Add relay candidates for TCP and XTLS
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

      // Complete ICE gathering to trigger resultReady emission for all protocols
      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();

      // Should have resultReady events for all 3 protocols
      assert.equal(emittedEvents[Events.resultReady].length, 3);
      const udpEvent = emittedEvents[Events.resultReady].find((e) => e.protocol === 'udp');
      assert.equal(udpEvent.protocol, 'udp');
      assert.deepEqual(udpEvent.clientMediaIPs, ['somePublicIp1']);
      // No clientMediaIpsUpdated events since gathering is now complete
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await promise;
    });

    it('relays natTypeUpdated event from ReachabilityPeerConnection', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', address: 'somePublicIp1', port: 1000, relatedPort: 3478},
      });

      // No NAT detection yet (only 1 candidate)
      assert.equal(emittedEvents[Events.natTypeUpdated].length, 0);

      // Second candidate with same address but different port - indicates symmetric NAT
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', address: 'somePublicIp1', port: 2000, relatedPort: 3478},
      });

      assert.equal(emittedEvents[Events.natTypeUpdated].length, 1);
      assert.deepEqual(emittedEvents[Events.natTypeUpdated][0], {
        natType: 'symmetric-nat',
      });

      clusterReachability.abort();
      await promise;
    });

    it('emits only the first successful UDP result when enablePerUdpUrlReachability is true', async () => {
      const perUdpClusterReachability = new ClusterReachability(
        'testName',
        {
          isVideoMesh: false,
          udp: ['stun:udp1', 'stun:udp2'],
          tcp: [],
          xtls: [],
        },
        true
      );

      const udpEvents: ResultEventData[] = [];
      perUdpClusterReachability.on(Events.resultReady, (data: ResultEventData) => {
        udpEvents.push(data);
      });

      const instance = perUdpClusterReachability as unknown as ClusterReachabilityPrivate;
      const udpRpc1 = instance.reachabilityPeerConnectionsForUdp[0];
      const udpRpc2 = instance.reachabilityPeerConnectionsForUdp[1];

      udpRpc1.emit({file: 'test', function: 'test'}, ReachabilityPeerConnectionEvents.resultReady, {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: 50,
        clientMediaIPs: ['1.1.1.1'],
      });

      udpRpc2.emit({file: 'test', function: 'test'}, ReachabilityPeerConnectionEvents.resultReady, {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: 30,
        clientMediaIPs: ['2.2.2.2'],
      });

      assert.equal(udpEvents.length, 1);
      assert.equal(udpEvents[0].protocol, 'udp');
    });
  });

  describe('#subnet collection', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('collects reached subnets from ReachabilityPeerConnection events', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', url: 'stun:192.168.1.1:5004', address: '5.5.5.5'},
      });
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', url: 'stun:10.0.0.1:5004', address: '5.5.5.5'},
      });
      fakePeerConnection.onicecandidate({
        candidate: {
          type: 'relay',
          address: '172.16.0.1',
          url: 'turn:172.16.0.1:5004',
          relayProtocol: 'tcp',
        },
      });

      clusterReachability.abort();
      await promise;

      assert.equal(clusterReachability.reachedSubnets.size, 2);
      assert.isTrue(clusterReachability.reachedSubnets.has('192.168.1.1'));
      assert.isTrue(clusterReachability.reachedSubnets.has('172.16.0.1'));
    });

    it('stores only unique subnet addresses', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:192.168.1.1:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:192.168.1.1:9000'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: '192.168.1.1'}});

      clusterReachability.abort();
      await promise;

      // Should have only 1 unique subnet
      assert.equal(clusterReachability.reachedSubnets.size, 1);
      assert.isTrue(clusterReachability.reachedSubnets.has('192.168.1.1'));
    });

    it('accumulates subnets from multiple candidates', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', url: 'stun:192.168.1.1:5004', address: '5.5.5.5'},
      });

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', url: 'stun:10.0.0.1:5004', address: '5.5.5.5'},
      });

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {
          type: 'relay',
          address: '172.16.0.1',
          url: 'turn:172.16.0.1:5004',
          relayProtocol: 'tcp',
        },
      });

      clusterReachability.abort();
      await promise;

      assert.equal(clusterReachability.reachedSubnets.size, 2);
      assert.deepEqual(Array.from(clusterReachability.reachedSubnets), [
        '192.168.1.1',
        '172.16.0.1',
      ]);
    });

    it('collects reached subnets from all peer connections when enablePerUdpUrlReachability is true', async () => {
      const perUdpClusterReachability = new ClusterReachability(
        'testName',
        {
          isVideoMesh: false,
          udp: ['stun:udp1', 'stun:udp2'],
          tcp: ['stun:tcp1.webex.com'],
          xtls: [],
        },
        true
      );

      const instance = perUdpClusterReachability as unknown as ClusterReachabilityPrivate;
      const udpRpc1 = instance.reachabilityPeerConnectionsForUdp[0];
      const udpRpc2 = instance.reachabilityPeerConnectionsForUdp[1];
      const tcpTlsRpc = instance.reachabilityPeerConnection;

      udpRpc1.emit(
        {file: 'test', function: 'test'},
        ReachabilityPeerConnectionEvents.reachedSubnets,
        {
          subnets: ['192.168.1.1'],
        }
      );
      udpRpc2.emit(
        {file: 'test', function: 'test'},
        ReachabilityPeerConnectionEvents.reachedSubnets,
        {
          subnets: ['10.0.0.1'],
        }
      );
      tcpTlsRpc.emit(
        {file: 'test', function: 'test'},
        ReachabilityPeerConnectionEvents.reachedSubnets,
        {
          subnets: ['172.16.0.1'],
        }
      );

      assert.equal(perUdpClusterReachability.reachedSubnets.size, 3);
      assert.isTrue(perUdpClusterReachability.reachedSubnets.has('192.168.1.1'));
      assert.isTrue(perUdpClusterReachability.reachedSubnets.has('10.0.0.1'));
      assert.isTrue(perUdpClusterReachability.reachedSubnets.has('172.16.0.1'));
    });
  });

  describe('#delegation', () => {
    it('delegates getResult() to ReachabilityPeerConnection', () => {
      const rpcGetResultStub = sinon
        .stub(clusterReachability.reachabilityPeerConnection, 'getResult')
        .returns({
          udp: {result: 'reachable', latencyInMilliseconds: 42},
          tcp: {result: 'unreachable'},
          xtls: {result: 'untested'},
        });

      const result = clusterReachability.getResult();

      assert.calledOnce(rpcGetResultStub);
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 42);
    });

    it('delegates abort() to ReachabilityPeerConnection', () => {
      const rpcAbortStub = sinon.stub(clusterReachability.reachabilityPeerConnection, 'abort');

      clusterReachability.abort();

      assert.calledOnce(rpcAbortStub);
    });

    it('delegates start() to ReachabilityPeerConnection and returns result', async () => {
      const expectedResult = {
        udp: {result: 'reachable'},
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      };

      const rpcStartStub = sinon
        .stub(clusterReachability.reachabilityPeerConnection, 'start')
        .resolves();
      const rpcGetResultStub = sinon
        .stub(clusterReachability.reachabilityPeerConnection, 'getResult')
        .returns(expectedResult);

      const result = await clusterReachability.start();

      assert.calledOnce(rpcStartStub);
      assert.calledOnce(rpcGetResultStub);
      assert.deepEqual(result, expectedResult);
    });

    it('delegates start() and abort() to all peer connections when enablePerUdpUrlReachability is true', async () => {
      const perUdpClusterReachability = new ClusterReachability(
        'testName',
        {
          isVideoMesh: false,
          udp: ['stun:udp1', 'stun:udp2'],
          tcp: ['stun:tcp1.webex.com'],
          xtls: [],
        },
        true
      );

      const instance = perUdpClusterReachability as unknown as ClusterReachabilityPrivate;
      const udpRpc1 = instance.reachabilityPeerConnectionsForUdp[0];
      const udpRpc2 = instance.reachabilityPeerConnectionsForUdp[1];
      const tcpTlsRpc = instance.reachabilityPeerConnection;

      const startStub1 = sinon.stub(udpRpc1, 'start').resolves({udp: {result: 'reachable'}});
      const startStub2 = sinon.stub(udpRpc2, 'start').resolves({udp: {result: 'unreachable'}});
      const startStubTcp = sinon.stub(tcpTlsRpc, 'start').resolves({tcp: {result: 'reachable'}});

      const abortStub1 = sinon.stub(udpRpc1, 'abort');
      const abortStub2 = sinon.stub(udpRpc2, 'abort');
      const abortStubTcp = sinon.stub(tcpTlsRpc, 'abort');

      await perUdpClusterReachability.start();

      assert.calledOnce(startStub1);
      assert.calledOnce(startStub2);
      assert.calledOnce(startStubTcp);

      perUdpClusterReachability.abort();

      assert.calledOnce(abortStub1);
      assert.calledOnce(abortStub2);
      assert.calledOnce(abortStubTcp);
    });
  });

  describe('#WebRTC peer connection setup', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should create a peer connection with the right config', () => {
      assert.calledOnceWithExactly(global.RTCPeerConnection, {
        iceServers: [
          {username: '', credential: '', urls: ['stun:udp1']},
          {username: '', credential: '', urls: ['stun:udp2']},
          {
            username: 'webexturnreachuser',
            credential: 'webexturnreachpwd',
            urls: ['turn:tcp1.webex.com?transport=tcp'],
          },
          {
            username: 'webexturnreachuser',
            credential: 'webexturnreachpwd',
            urls: ['turn:tcp2.webex.com:5004?transport=tcp'],
          },
          {
            username: 'webexturnreachuser',
            credential: 'webexturnreachpwd',
            urls: ['turns:xtls1.webex.com?transport=tcp'],
          },
          {
            username: 'webexturnreachuser',
            credential: 'webexturnreachpwd',
            urls: ['turns:xtls2.webex.com:443?transport=tcp'],
          },
        ],
        iceCandidatePoolSize: 0,
        iceTransportPolicy: 'all',
      });
    });

    it('should initiate the ICE gathering process', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      // check that the right listeners are setup
      assert.isFunction(fakePeerConnection.onicecandidate);
      assert.isFunction(fakePeerConnection.onicegatheringstatechange);

      // check that the right webrtc APIs are called
      assert.calledOnceWithExactly(fakePeerConnection.createOffer, {offerToReceiveAudio: true});
      assert.calledOnce(fakePeerConnection.setLocalDescription);

      // Make sure that gatherIceCandidates is called before setLocalDescription
      // as setLocalDescription triggers the ICE gathering process
      assert.isTrue(gatherIceCandidatesSpy.calledBefore(fakePeerConnection.setLocalDescription));

      clusterReachability.abort();
      await promise;

      // verify that no events were emitted
      assert.deepEqual(emittedEvents[Events.resultReady], []);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);
    });

    it('resolves when ICE gathering is completed', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'unreachable');
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'unreachable');
    });

    it('resolves with the right result when ICE gathering is completed', async () => {
      const promise = clusterReachability.start();

      // send 1 candidate
      await clock.tickAsync(30);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 30);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp1']);
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'unreachable');
    });

    it('resolves and returns correct results when aborted before it gets any candidates', async () => {
      const promise = clusterReachability.start();

      // progress time without any candidates
      clusterReachability.abort();
      await promise;

      // verify that no events were emitted
      assert.deepEqual(emittedEvents[Events.resultReady], []);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'unreachable');
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'unreachable');
    });

    it('resolves and returns correct results when aborted after getting some candidates', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp'}});

      // Add relay candidates for TCP and XTLS
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'relayIp'}});
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'relayIp', port: 443},
      });

      // Complete ICE gathering to trigger resultReady emission
      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();

      // check the right events were emitted for all 3 protocols
      assert.equal(emittedEvents[Events.resultReady].length, 3);
      const udpEvent = emittedEvents[Events.resultReady].find((e) => e.protocol === 'udp');
      assert.equal(udpEvent.protocol, 'udp');
      assert.equal(udpEvent.result, 'reachable');
      assert.equal(udpEvent.latencyInMilliseconds, 100);
      assert.deepEqual(udpEvent.clientMediaIPs, ['somePublicIp']);

      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 100);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp']);
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.xtls.result, 'reachable');
    });
  });

  describe('#latency and candidate handling', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should store latency only for the first srflx candidate, but IPs from all of them', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      await clock.tickAsync(50); // total elapsed time: 60
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      await clock.tickAsync(10); // total elapsed time: 70
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp3'}});

      clusterReachability.abort();
      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from all UDP candidates
      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 10);
      assert.deepEqual(result.udp.clientMediaIPs, [
        'somePublicIp1',
        'somePublicIp2',
        'somePublicIp3',
      ]);
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'unreachable');
    });

    it('should store latency only for the first relay candidate', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'relayIp1', port: 3478},
      });

      await clock.tickAsync(50); // total elapsed time: 60
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'relayIp2', port: 3478},
      });

      clusterReachability.abort();
      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'unreachable');
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.tcp.latencyInMilliseconds, 10);
      assert.equal(result.xtls.result, 'unreachable');
    });

    it('should store latency only for the first tls relay candidate', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'relayIp1', port: 443},
      });

      await clock.tickAsync(50); // total elapsed time: 60
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'relayIp2', port: 443},
      });

      clusterReachability.abort();
      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'unreachable');
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'reachable');
      assert.equal(result.xtls.latencyInMilliseconds, 10);
    });

    it('handles new found public IPs and ignores duplicate IPs', async () => {
      const promise = clusterReachability.start();

      // generate candidates BEFORE completing ICE gathering
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // send relay candidates for TCP/XTLS
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

      // Complete ICE gathering to trigger all resultReady emissions
      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();

      // Should have resultReady events for all 3 protocols
      assert.equal(emittedEvents[Events.resultReady].length, 3);
      const udpEvent = emittedEvents[Events.resultReady].find((e) => e.protocol === 'udp');
      assert.equal(udpEvent.result, 'reachable');
      assert.equal(udpEvent.latencyInMilliseconds, 10);
      assert.deepEqual(udpEvent.clientMediaIPs, ['somePublicIp1']);
      const tcpEvent = emittedEvents[Events.resultReady].find((e) => e.protocol === 'tcp');
      assert.equal(tcpEvent.result, 'reachable');
      assert.equal(tcpEvent.latencyInMilliseconds, 20);
      const xtlsEvent = emittedEvents[Events.resultReady].find((e) => e.protocol === 'xtls');
      assert.equal(xtlsEvent.result, 'reachable');
      assert.equal(xtlsEvent.latencyInMilliseconds, 30);
      // No clientMediaIpsUpdated since gathering is complete
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 10);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp1']);
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.tcp.latencyInMilliseconds, 20);
      assert.equal(result.xtls.result, 'reachable');
      assert.equal(result.xtls.latencyInMilliseconds, 30);
    });

    it('determines correctly if symmetric-nat is detected', async () => {
      const promise = clusterReachability.start();

      // generate candidates with duplicate addresses
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', address: 'somePublicIp1', relatedPort: 3478, port: 1000},
      });

      // check events emitted: there shouldn't be any natTypeUpdated emitted
      assert.equal(emittedEvents[Events.natTypeUpdated].length, 0);

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'srflx', address: 'somePublicIp1', relatedPort: 3478, port: 2000},
      });

      // should emit natTypeUpdated event
      assert.equal(emittedEvents[Events.natTypeUpdated].length, 1);
      assert.equal(emittedEvents[Events.natTypeUpdated][0].natType, 'symmetric-nat');

      // send also a relay candidate so that the reachability check finishes
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await clock.tickAsync(10);

      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 10);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp1']);
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.tcp.latencyInMilliseconds, 20);
      assert.equal(result.xtls.result, 'reachable');
      assert.equal(result.xtls.latencyInMilliseconds, 20);
    });
  });
});
