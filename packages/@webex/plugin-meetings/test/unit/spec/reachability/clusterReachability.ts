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

describe('ClusterReachability', () => {
  let previousRTCPeerConnection;
  let clusterReachability;
  let fakePeerConnection;
  let gatherIceCandidatesSpy;

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
    };

    previousRTCPeerConnection = global.RTCPeerConnection;
    global.RTCPeerConnection = sinon.stub().returns(fakePeerConnection);

    clusterReachability = new ClusterReachability('testName', {
      isVideoMesh: false,
      udp: ['stun:udp1', 'stun:udp2'],
      tcp: ['stun:tcp1.webex.com', 'stun:tcp2.webex.com:5004'],
      xtls: ['stun:xtls1.webex.com', 'stun:xtls2.webex.com:443'],
    });

    gatherIceCandidatesSpy = sinon.spy(clusterReachability.reachabilityPeerConnection as any, 'gatherIceCandidates');

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
    assert.deepEqual(clusterReachability.getResult(), {
      udp: {result: 'untested'},
      tcp: {result: 'untested'},
      xtls: {result: 'untested'},
    });

    // verify that no events were emitted
    assert.deepEqual(emittedEvents[Events.resultReady], []);
    assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);
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

      // ClusterReachability should relay the event
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      assert.deepEqual(emittedEvents[Events.resultReady][0], {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: 50,
        clientMediaIPs: ['somePublicIp1'],
      });

      clusterReachability.abort();
      await promise;
    });

    it('relays clientMediaIpsUpdated event from ReachabilityPeerConnection', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // First IP found - only resultReady emitted
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);
      resetEmittedEvents();

      // New IP found - should emit clientMediaIpsUpdated
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      assert.equal(emittedEvents[Events.resultReady].length, 0);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 1);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated][0], {
        protocol: 'udp',
        clientMediaIPs: ['somePublicIp1', 'somePublicIp2'],
      });

      clusterReachability.abort();
      await promise;
    });

    it('relays natTypeUpdated event from ReachabilityPeerConnection', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1', port: 1000, relatedPort: 3478}});

      // No NAT detection yet (only 1 candidate)
      assert.equal(emittedEvents[Events.natTypeUpdated].length, 0);

      // Second candidate with same address but different port - indicates symmetric NAT
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1', port: 2000, relatedPort: 3478}});

      assert.equal(emittedEvents[Events.natTypeUpdated].length, 1);
      assert.deepEqual(emittedEvents[Events.natTypeUpdated][0], {
        natType: 'symmetric-nat',
      });

      clusterReachability.abort();
      await promise;
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
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:192.168.1.1:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:10.0.0.1:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'relay.server.ip'}});

      clusterReachability.abort();
      await promise;

      assert.equal(clusterReachability.reachedSubnets.size, 3);
      assert.isTrue(clusterReachability.reachedSubnets.has('192.168.1.1'));
      assert.isTrue(clusterReachability.reachedSubnets.has('10.0.0.1'));
      assert.isTrue(clusterReachability.reachedSubnets.has('relay.server.ip'));
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
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:192.168.1.1:5004'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:10.0.0.1:5004'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: '172.16.0.1'}});

      clusterReachability.abort();
      await promise;

      assert.equal(clusterReachability.reachedSubnets.size, 3);
      assert.deepEqual(Array.from(clusterReachability.reachedSubnets), ['192.168.1.1', '10.0.0.1', '172.16.0.1']);
    });
  });

  describe('#delegation', () => {
    it('delegates getResult() to ReachabilityPeerConnection', () => {
      const rpcGetResultStub = sinon.stub(clusterReachability.reachabilityPeerConnection, 'getResult').returns({
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

      const rpcStartStub = sinon.stub(clusterReachability.reachabilityPeerConnection, 'start').resolves();
      const rpcGetResultStub = sinon.stub(clusterReachability.reachabilityPeerConnection, 'getResult').returns(expectedResult);

      const result = await clusterReachability.start();

      assert.calledOnce(rpcStartStub);
      assert.calledOnce(rpcGetResultStub);
      assert.deepEqual(result, expectedResult);
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

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      });
    });

    it('resolves with the right result when ICE gathering is completed', async () => {
      const promise = clusterReachability.start();

      // send 1 candidate
      await clock.tickAsync(30);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 30, clientMediaIPs: ['somePublicIp1']},
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      });
    });

    it('resolves and returns correct results when aborted before it gets any candidates', async () => {
      const promise = clusterReachability.start();

      // progress time without any candidates
      clusterReachability.abort();
      await promise;

      // verify that no events were emitted
      assert.deepEqual(emittedEvents[Events.resultReady], []);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      });
    });

    it('resolves and returns correct results when aborted after getting some candidates', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp'}});

      // check the right event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      assert.deepEqual(emittedEvents[Events.resultReady][0], {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: 100,
        clientMediaIPs: ['somePublicIp'],
      });

      clusterReachability.abort();
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['somePublicIp']},
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      });
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
      assert.deepEqual(clusterReachability.getResult(), {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
          clientMediaIPs: ['somePublicIp1', 'somePublicIp2', 'somePublicIp3'],
        },
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      });
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

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'reachable', latencyInMilliseconds: 10},
        xtls: {result: 'unreachable'},
      });
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

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'unreachable'},
        xtls: {result: 'reachable', latencyInMilliseconds: 10},
      });
    });

    it('handles new found public IPs and ignores duplicate IPs', async () => {
      const promise = clusterReachability.start();

      // generate candidates with duplicate addresses
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      // check events emitted: there should be a resultReady and no clientMediaIpsUpdated
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      assert.deepEqual(emittedEvents[Events.resultReady][0], {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: 10,
        clientMediaIPs: ['somePublicIp1'],
      });
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
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated][0], {
        protocol: 'udp',
        clientMediaIPs: ['somePublicIp1', 'somePublicIp2'],
      });
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

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
          clientMediaIPs: ['somePublicIp1', 'somePublicIp2'],
        },
        tcp: {result: 'reachable', latencyInMilliseconds: 40},
        xtls: {result: 'reachable', latencyInMilliseconds: 40},
      });
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
      assert.deepEqual(emittedEvents[Events.natTypeUpdated][0], {
        natType: 'symmetric-nat',
      });

      // send also a relay candidate so that the reachability check finishes
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await clock.tickAsync(10);

      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
          clientMediaIPs: ['somePublicIp1'],
        },
        tcp: {result: 'reachable', latencyInMilliseconds: 20},
        xtls: {result: 'reachable', latencyInMilliseconds: 20},
      });
    });
  });
});
