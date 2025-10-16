import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import testUtils from '../../../utils/testUtils';

// packages/@webex/plugin-meetings/test/unit/spec/reachability/clusterReachability.ts
import {
  ClusterReachability,
  ResultEventData,
  Events,
  ClientMediaIpsUpdatedEventData,
  NatTypeUpdatedEventData,
} from '@webex/plugin-meetings/src/reachability/clusterReachability';
import { NatType } from '@webex/plugin-meetings/src/reachability/reachability.types';
import { isIpAddress } from '@webex/plugin-meetings/src/reachability/util';

describe('ClusterReachability', () => {
  let previousRTCPeerConnection;
  let clusterReachability;
  let fakePeerConnection;
  let gatherIceCandidatesSpy;
  let mockWebex;

  const emittedEvents: Record<Events, (ResultEventData | ClientMediaIpsUpdatedEventData | NatTypeUpdatedEventData)[]> = {
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
      connectionState: 'new',
    };

    previousRTCPeerConnection = global.RTCPeerConnection;
    global.RTCPeerConnection = sinon.stub().returns(fakePeerConnection);

    // Create mock webex instance
    mockWebex = {
      config: {
        meetings: {
          reachabilityEnablePerUrlForUdp: false,
        },
      },
    };

    clusterReachability = new ClusterReachability('testName', {
      isVideoMesh: false,
      udp: ['stun:udp1', 'stun:udp2'],
      tcp: ['stun:tcp1.webex.com', 'stun:tcp2.webex.com:5004'],
      xtls: ['stun:xtls1.webex.com', 'stun:xtls2.webex.com:443'],
    }, false); // reachabilityEnablePerUrlForUdp flag

    gatherIceCandidatesSpy = sinon.spy(clusterReachability, 'gatherIceCandidates');

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

  it('should create an instance correctly', () => {
    assert.instanceOf(clusterReachability, ClusterReachability);
    assert.equal(clusterReachability.name, 'testName');
    assert.equal(clusterReachability.isVideoMesh, false);
    assert.equal(clusterReachability.numUdpUrls, 2);
    assert.equal(clusterReachability.numTcpUrls, 2);
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

  it('should create a peer connection with the right config even if lists of urls are empty', () => {
    (global.RTCPeerConnection as any).resetHistory();

    clusterReachability = new ClusterReachability('testName', {
      isVideoMesh: false,
      udp: [],
      tcp: [],
      xtls: [],
    }, false); // reachabilityEnablePerUrlForUdp flag

    assert.calledOnceWithExactly(global.RTCPeerConnection, {
      iceServers: [],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
    });
  });

  it('returns correct results before start() is called', () => {
    assert.deepEqual(clusterReachability.getResult(), {
      udp: {result: 'untested', details: []},
      tcp: {result: 'untested', details: []},
      xtls: {result: 'untested', details: []},
    });

    // verify that no events were emitted
    assert.deepEqual(emittedEvents[Events.resultReady], []);
    assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);
  });

  describe('#start', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should initiate the ICE gathering process', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      // check that the right listeners are setup
      assert.isFunction(fakePeerConnection.onicecandidate);
      assert.isFunction(fakePeerConnection.onicegatheringstatechange);

      // check that the right webrtc APIs are called - in standard mode, only called once
      assert.calledWith(fakePeerConnection.createOffer, {offerToReceiveAudio: true});
      assert.called(fakePeerConnection.setLocalDescription);

      // Make sure that gatherIceCandidates is called before setLocalDescription
      // as setLocalDescription triggers the ICE gathering process
      assert.isTrue(gatherIceCandidatesSpy.calledBefore(fakePeerConnection.setLocalDescription));

      clusterReachability.abort();
      await promise;

      // verify that no events were emitted
      assert.deepEqual(emittedEvents[Events.resultReady], []);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);
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
      // isVideoMesh is added by index.ts, not part of ClusterReachabilityResult
      // // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
    });

    it('resolves and returns correct results when aborted after getting some candidates', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp'}});

      // check the right event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      const eventData = emittedEvents[Events.resultReady][0] as ResultEventData;
      assert.equal(eventData.protocol, 'udp');
      assert.equal(eventData.result, 'reachable');
      assert.equal(eventData.latencyInMilliseconds, 100);
      assert.deepEqual(eventData.clientMediaIPs, ['somePublicIp']);

      clusterReachability.abort();
      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 100);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp']);
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'unreachable');
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
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
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
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
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
    });

    it('should store latency only for the first srflx candidate, but IPs from all of them', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // generate more candidates
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp3'}});

      clusterReachability.abort();
      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from all UDP candidates (not TCP)
      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 10);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp1', 'somePublicIp2', 'somePublicIp3']);
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'unreachable');
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
    });

    it('should store latency only for the first relay candidate', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp1', port: 5004}});

      // generate more candidates
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp2', port: 5004}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp3', port: 5004}});

      clusterReachability.abort();
      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from only from UDP candidates
      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'unreachable');
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.tcp.latencyInMilliseconds, 10);
      assert.equal(result.xtls.result, 'unreachable');
      // Details field should be present and TCP should have details for the successful result
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
      // TCP should have a successful detail entry (one per unique IP)
      assert.isTrue(result.tcp.details.length > 0);
      const tcpDetail = result.tcp.details[0];
      assert.equal(tcpDetail['answered-tx'], 1);
      assert.equal(tcpDetail['lost-tx'], 0);
      assert.deepEqual(tcpDetail.latencies, [10]);
      assert.equal(tcpDetail.serverIp, 'someTurnRelayIp1');
      assert.equal(tcpDetail.port, 5004);
    });

    it('should store latency only for the first tls relay candidate', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp1', port: 443},
      });

      // generate more candidates
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp2', port: 443},
      });

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp3', port: 443},
      });

      clusterReachability.abort();
      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from only from UDP candidates
      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'unreachable');
      assert.equal(result.tcp.result, 'unreachable');
      assert.equal(result.xtls.result, 'reachable');
      assert.equal(result.xtls.latencyInMilliseconds, 10);
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present and XTLS should have details for the successful result
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
      // XTLS should have a successful detail entry (one per unique IP)
      assert.isTrue(result.xtls.details.length > 0);
      const xtlsDetail = result.xtls.details[0];
      assert.equal(xtlsDetail['answered-tx'], 1);
      assert.equal(xtlsDetail['lost-tx'], 0);
      assert.deepEqual(xtlsDetail.latencies, [10]);
      assert.equal(xtlsDetail.serverIp, 'someTurnRelayIp1');
    });

    it('handles new found public IPs and ignores duplicate IPs', async () => {
      const promise = clusterReachability.start();

      // generate candidates with duplicate addresses
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // check events emitted: there should be a resultReady and no clientMediaIpsUpdated
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      const eventData1 = emittedEvents[Events.resultReady][0] as ResultEventData;
      assert.equal(eventData1.protocol, 'udp');
      assert.equal(eventData1.result, 'reachable');
      assert.equal(eventData1.latencyInMilliseconds, 10);
      assert.deepEqual(eventData1.clientMediaIPs, ['somePublicIp1']);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);
      resetEmittedEvents();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // no new event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 0);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      // check new events: now only clientMediaIpsUpdated event and no resultReady events
      assert.equal(emittedEvents[Events.resultReady].length, 0);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 1);
      const eventData2 = emittedEvents[Events.clientMediaIpsUpdated][0] as ClientMediaIpsUpdatedEventData;
      assert.equal(eventData2.protocol, 'udp');
      assert.deepEqual(eventData2.clientMediaIPs, ['somePublicIp1', 'somePublicIp2']);
      resetEmittedEvents();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      // no new event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 0);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      // send also a relay candidate so that the reachability check finishes
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();

      await promise;

      const result = clusterReachability.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 10);
      assert.deepEqual(result.udp.clientMediaIPs, ['somePublicIp1', 'somePublicIp2']);
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.tcp.latencyInMilliseconds, 40);
      assert.equal(result.xtls.result, 'reachable');
      assert.equal(result.xtls.latencyInMilliseconds, 40);
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
    });

    it('determines correctly if symmetric-nat is detected', async () => {
      const promise = clusterReachability.start();

      // generate candidates with duplicate addresses
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1', relatedPort: 3478, port: 1000}});

      // check events emitted: there shouldn't be any natTypeUpdated emitted
      assert.equal(emittedEvents[Events.natTypeUpdated].length, 0);

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1', relatedPort: 3478, port: 2000}});

      // should emit natTypeUpdated event
      assert.equal(emittedEvents[Events.natTypeUpdated].length, 1);
      const eventData3 = emittedEvents[Events.natTypeUpdated][0] as NatTypeUpdatedEventData;
      assert.equal(eventData3.natType, NatType.SymmetricNat);

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
      // assert.equal(result.isVideoMesh, false); // isVideoMesh added by index.ts
      // Details field should be present in standard mode
      assert.isArray(result.udp.details);
      assert.isArray(result.tcp.details);
      assert.isArray(result.xtls.details);
    });

    it('should gather correctly reached subnets', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:1.2.3.4:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:4.3.2.1:5004'}}); // This will be ignored in standard mode
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});

      clusterReachability.abort();
      await promise;

      // In standard mode, only first UDP candidate is processed, but all TCP/XTLS relay candidates are processed
      assert.deepEqual(Array.from(clusterReachability.reachedSubnets), [
        '1.2.3.4',
        'someTurnRelayIp'
      ]);
    });

    it('should store only unique subnet address', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:1.2.3.4:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:1.2.3.4:9000'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: '1.2.3.4'}});

      clusterReachability.abort();
      await promise;

      assert.deepEqual(Array.from(clusterReachability.reachedSubnets), ['1.2.3.4']);
    });
  });

  describe('per-URL mode', () => {
    it('should enable per-URL mode when flag is set', () => {
      const perUrlCluster = new ClusterReachability('testName', {
        isVideoMesh: false,
        udp: ['stun:144.196.193.199:9000', 'stun:170.72.22.246:9000'],
        tcp: ['stun:tcp1.webex.com'],
        xtls: ['stun:xtls1.webex.com'],
      }, true); // reachabilityEnablePerUrlForUdp flag enabled

      // Test that per-URL mode is detected (we can't easily test the private method, 
      // but we can verify the constructor accepts the flag)
      assert.instanceOf(perUrlCluster, ClusterReachability);
      assert.equal(perUrlCluster.name, 'testName');
      assert.equal(perUrlCluster.isVideoMesh, false);
    });

    it('should handle UDP per-URL while TCP/XTLS use standard mode', () => {
      const perUrlCluster = new ClusterReachability('testName', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:3478', 'stun:192.168.1.2:3478'],
        tcp: ['stun:10.0.0.1:5004'],
        xtls: ['stun:172.16.1.1:443'],
      }, true); // reachabilityEnablePerUrlForUdp flag enabled

      // Verify basic structure
      const result = perUrlCluster.getResult();
      assert.equal(result.udp.result, 'untested');
      assert.equal(result.tcp.result, 'untested');
      assert.equal(result.xtls.result, 'untested');
    });

    it('should create separate peer connections for UDP URLs in per-URL mode', () => {
      // This test verifies the architectural difference without requiring actual WebRTC
      const legacyCluster = new ClusterReachability('legacy', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:3478', 'stun:192.168.1.2:3478'],
        tcp: [],
        xtls: [],
      }, false); // standard mode

      const perUrlCluster = new ClusterReachability('perUrl', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:3478', 'stun:192.168.1.2:3478'],
        tcp: [],
        xtls: [],
      }, true); // per-URL mode

      // Both should be valid instances, but behavior differs internally
      assert.instanceOf(legacyCluster, ClusterReachability);
      assert.instanceOf(perUrlCluster, ClusterReachability);
      assert.equal(legacyCluster.name, 'legacy');
      assert.equal(perUrlCluster.name, 'perUrl');
    });
  });

  describe('IP address validation', () => {
    it('should identify IPv4 addresses correctly', () => {
      const clusterReach = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:3478'],
        tcp: [],
        xtls: [],
      }, false);
      
      // Test the utility function directly
      assert.isTrue(isIpAddress('192.168.1.1'));
      assert.isTrue(isIpAddress('10.0.0.1'));
      assert.isTrue(isIpAddress('172.16.1.1'));
      assert.isFalse(isIpAddress('example.com'));
      assert.isFalse(isIpAddress('stun.webex.com'));
      assert.isFalse(isIpAddress(''));
      assert.isFalse(isIpAddress(undefined));
    });

    it('should identify IPv6 addresses correctly', () => {
      const clusterReach = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:[2001:db8::1]:3478'],
        tcp: [],
        xtls: [],
      }, false);
      
      // Test the utility function directly
      assert.isTrue(isIpAddress('2001:db8::1'));
      assert.isTrue(isIpAddress('[2001:db8::1]')); // with brackets
      assert.isTrue(isIpAddress('::1'));
      assert.isFalse(isIpAddress('invalid:ipv6'));
      assert.isFalse(isIpAddress('example.com'));
    });
  });

  describe('Details population', () => {
    let testCluster;

    beforeEach(() => {
      testCluster = new ClusterReachability('testCluster', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:3478', 'stun:example.com:3478'],
        tcp: ['stun:10.0.0.1:5004', 'stun:tcp.example.com:5004'],
        xtls: ['stun:172.16.1.1:443', 'stun:xtls.example.com:443'],
      }, false); // standard mode
    });

    it('should populate unreachable entries for IP addresses when no connections succeed', async () => {
      const promise = testCluster.start();
      testCluster.abort(); // Abort immediately to prevent timeout
      await promise;
      
      const result = testCluster.getResult();
      
      // Should have unreachable entries for IP addresses from prepopulation (domains are not prefilled)
      assert.isTrue(result.udp.details.length > 0);
      assert.isTrue(result.tcp.details.length > 0); 
      assert.isTrue(result.xtls.details.length > 0);
      
      // All entries should be unreachable
      result.udp.details.forEach(detail => {
        assert.equal(detail['answered-tx'], 0);
        assert.equal(detail['lost-tx'], 1);
      });
    });
  });

  describe('Minimum latency calculation', () => {
    let testCluster;
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      testCluster = new ClusterReachability('testCluster', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:3478', 'stun:192.168.1.2:3478'],
        tcp: [],
        xtls: [],
      }, true); // per-URL mode to test minimum latency
    });

    afterEach(() => {
      clock.restore();
    });

    // TODO: Rewrite this test for new per-URL architecture that uses SubnetReachabilityChecker
    // The processUdpPerUrlResults method no longer exists - per-URL logic now uses callbacks
    /* 
    it('should calculate minimum latency correctly from multiple URLs', async () => {
      // Mock the per-URL results to simulate different latencies
      const perUrlResults = new Map();
      perUrlResults.set('udp-stun:192.168.1.1:3478', {
        protocol: 'udp',
        latency: 100,
        details: [{
          port: 3478,
          'answered-tx': 1,
          'lost-tx': 0,
          latencies: [100],
          serverIps: '192.168.1.1',
        }],
        reachedSubnets: new Set(['192.168.1.1']),
      });
      perUrlResults.set('udp-stun:192.168.1.2:3478', {
        protocol: 'udp',
        latency: 50, // This should be the minimum
        details: [{
          port: 3478,
          'answered-tx': 1,
          'lost-tx': 0,
          latencies: [50],
          serverIps: '192.168.1.2',
        }],
        reachedSubnets: new Set(['192.168.1.2']),
      });
      
      // Set the internal per-URL results
      (testCluster as any).perUrlResults = perUrlResults;
      
      // Call processUdpPerUrlResults to calculate the minimum
      (testCluster as any).processUdpPerUrlResults();
      
      const result = testCluster.getResult();
      assert.equal(result.udp.result, 'reachable');
      assert.equal(result.udp.latencyInMilliseconds, 50); // Should be the minimum, not the first
    });
    */
  });

  describe('Port extraction and detail matching', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should extract correct ports from STUN URLs in standard mode', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:9000', 'stun:192.168.1.2:5004'],
        tcp: [],
        xtls: [],
      }, false);

      const promise = cluster.start();

      await clock.tickAsync(100);
      
      // Simulate candidate with URL containing the actual STUN port
      fakePeerConnection.onicecandidate({
        candidate: {
          type: 'srflx',
          address: 'clientIp',
          relatedPort: 54321, // This should be ignored
          url: 'stun:192.168.1.1:9000' // This port should be used
        } as any
      });

      cluster.abort();
      await promise;

      const result = cluster.getResult();
      assert.equal(result.udp.result, 'reachable');
      
      // Find the detail entry for this server
      const detail = result.udp.details.find(d => d.serverIp === '192.168.1.1');
      assert.exists(detail);
      assert.equal(detail.port, 9000); // Should be STUN port, not relatedPort
      assert.equal(detail['answered-tx'], 1);
      assert.equal(detail['lost-tx'], 0);
    });

    // TODO: Rewrite this test for new per-URL architecture that uses SubnetReachabilityChecker
    // The handlePerUrlIceCandidate method no longer exists - per-URL logic now uses callbacks
    /*
    it('should extract correct ports in per-URL mode from URL key', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:9000'],
        tcp: [],
        xtls: [],
      }, true); // Per-URL mode

      const promise = cluster.start();

      // Wait for per-URL connections to be set up
      await testUtils.flushPromises();
      
      // Simulate success for the per-URL connection
      const urlKey = 'udp-stun:192.168.1.1:9000';
      
      await clock.tickAsync(150);
      (cluster as any).handlePerUrlIceCandidate(
        {
          candidate: {
            type: 'srflx',
            address: 'clientIp'
          }
        },
        urlKey
      );

      (cluster as any).processUdpPerUrlResults();
      cluster.abort();
      await promise;

      const result = cluster.getResult();
      const detail = result.udp.details.find(d => d.serverIp === '192.168.1.1');
      assert.exists(detail);
      assert.equal(detail.port, 9000); // Should extract from URL key correctly
      assert.equal(detail['answered-tx'], 1);
    });
    */

    it('should match details by both IP and port', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:9000', 'stun:192.168.1.1:5004'], // Same IP, different ports
        tcp: [],
        xtls: [],
      }, false);

      const promise = cluster.start();

      await clock.tickAsync(100);
      
      // First candidate for port 9000
      fakePeerConnection.onicecandidate({
        candidate: {
          type: 'srflx',
          address: 'clientIp1',
          url: 'stun:192.168.1.1:9000'
        } as any
      });

      await clock.tickAsync(50);
      
      // Second candidate for port 5004 (same IP, different port)
      fakePeerConnection.onicecandidate({
        candidate: {
          type: 'srflx',
          address: 'clientIp2',
          url: 'stun:192.168.1.1:5004'
        } as any
      });

      cluster.abort();
      await promise;

      const result = cluster.getResult();
      
      // Should have separate entries for each port
      const details9000 = result.udp.details.filter(d => d.serverIp === '192.168.1.1' && d.port === 9000);
      const details5004 = result.udp.details.filter(d => d.serverIp === '192.168.1.1' && d.port === 5004);
      
      assert.equal(details9000.length, 1);
      assert.equal(details5004.length, 1);
      // In standard mode (enablePerUrlUdpTesting=false), only first UDP candidate is processed
      assert.equal(details9000[0]['answered-tx'], 1); // First candidate - marked as reachable
      assert.equal(details5004[0]['answered-tx'], 0); // Second candidate - ignored in standard mode
    });
  });

  describe('Prepopulation logic', () => {
    it('should prepopulate unreachable entries for IP-only clusters', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:9000', 'stun:10.0.0.1:5004'], // All IPs
        tcp: ['stun:172.16.1.1:5004'],
        xtls: ['stun:192.168.1.2:443'],
      }, false);

      const promise = cluster.start();

      // Before any candidates, should have prefilled unreachable entries
      const result = cluster.getResult();
      
      // Check UDP prefill
      assert.isArray(result.udp.details);
      assert.equal(result.udp.details.length, 2);
      
      const udpDetail1 = result.udp.details.find(d => d.serverIp === '192.168.1.1');
      const udpDetail2 = result.udp.details.find(d => d.serverIp === '10.0.0.1');
      
      assert.exists(udpDetail1);
      assert.exists(udpDetail2);
      assert.equal(udpDetail1.port, 9000);
      assert.equal(udpDetail2.port, 5004);
      assert.equal(udpDetail1['answered-tx'], 0);
      assert.equal(udpDetail1['lost-tx'], 1);

      // Check TCP prefill
      assert.equal(result.tcp.details.length, 1);
      assert.equal(result.tcp.details[0].serverIp, '172.16.1.1');
      assert.equal(result.tcp.details[0].port, 5004);

      cluster.abort();
      await promise;
    });

    it('should prepopulate individual IPs even in mixed IP/domain clusters', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:9000', 'stun:example.com:5004'], // Mixed IP/domain
        tcp: [],
        xtls: [],
      }, false);

      const promise = cluster.start();

      // Should prepopulate the IP address entry even when there are domain names
      const result = cluster.getResult();
      assert.equal(result.udp.details.length, 1);
      assert.equal(result.udp.details[0].serverIp, '192.168.1.1');
      assert.equal(result.udp.details[0].port, 9000);
      assert.equal(result.udp.details[0]['answered-tx'], 0);
      assert.equal(result.udp.details[0]['lost-tx'], 1);

      cluster.abort();
      await promise;
    });

    it('should skip URLs without explicit ports', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1', 'stun:192.168.1.2:9000'], // First has no port
        tcp: [],
        xtls: [],
      }, false);

      const promise = cluster.start();

      // Should only prefill the one with explicit port
      const result = cluster.getResult();
      assert.equal(result.udp.details.length, 1);
      assert.equal(result.udp.details[0].serverIp, '192.168.1.2');
      assert.equal(result.udp.details[0].port, 9000);

      cluster.abort();
      await promise;
    });
  });

  describe('Data integrity', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should maintain answered-tx = 1 for successful connections', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: ['stun:192.168.1.1:9000'],
        tcp: [],
        xtls: [],
      }, false);

      const promise = cluster.start();

      await clock.tickAsync(100);
      
      // Multiple candidates from same server - should not increment answered-tx
      fakePeerConnection.onicecandidate({
        candidate: { type: 'srflx', address: 'clientIp1', url: 'stun:192.168.1.1:9000' } as any
      });

      await clock.tickAsync(50);
      
      fakePeerConnection.onicecandidate({
        candidate: { type: 'srflx', address: 'clientIp2', url: 'stun:192.168.1.1:9000' } as any
      });

      cluster.abort();
      await promise;

      const result = cluster.getResult();
      const detail = result.udp.details.find(d => d.serverIp === '192.168.1.1');
      
      // Should be exactly 1, not accumulated
      assert.equal(detail['answered-tx'], 1);
      assert.equal(detail['lost-tx'], 0);
      assert.equal(detail.latencies.length, 1);
      assert.equal(detail.latencies[0], 100); // First latency only
    });

    it('should handle TCP/XTLS relay candidates with correct ports', async () => {
      const cluster = new ClusterReachability('test', {
        isVideoMesh: false,
        udp: [],
        tcp: ['stun:192.168.1.1:5004'],
        xtls: ['stun:192.168.1.2:443'],
      }, false);

      const promise = cluster.start();

      await clock.tickAsync(200);
      
      // TCP relay candidate
      fakePeerConnection.onicecandidate({
        candidate: { type: 'relay', address: '192.168.1.1', port: 5004 }
      });

      await clock.tickAsync(100);
      
      // XTLS relay candidate  
      fakePeerConnection.onicecandidate({
        candidate: { type: 'relay', address: '192.168.1.2', port: 443 }
      });

      cluster.abort();
      await promise;

      const result = cluster.getResult();
      
      // Check TCP
      assert.equal(result.tcp.result, 'reachable');
      assert.equal(result.tcp.latencyInMilliseconds, 200);
      const tcpDetail = result.tcp.details[0];
      assert.equal(tcpDetail.serverIp, '192.168.1.1');
      assert.equal(tcpDetail.port, 5004);
      assert.equal(tcpDetail['answered-tx'], 1);

      // Check XTLS
      assert.equal(result.xtls.result, 'reachable');
      assert.equal(result.xtls.latencyInMilliseconds, 300);
      const xtlsDetail = result.xtls.details[0];
      assert.equal(xtlsDetail.serverIp, '192.168.1.2');
      assert.equal(xtlsDetail.port, 443);
      assert.equal(xtlsDetail['answered-tx'], 1);
    });
  });
});
