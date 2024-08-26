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
} from '@webex/plugin-meetings/src/reachability/clusterReachability'; // replace with actual path

describe('ClusterReachability', () => {
  let previousRTCPeerConnection;
  let clusterReachability;
  let fakePeerConnection;

  const emittedEvents: Record<Events, (ResultEventData | ClientMediaIpsUpdatedEventData)[]> = {
    [Events.resultReady]: [],
    [Events.clientMediaIpsUpdated]: [],
  };
  const FAKE_OFFER = {type: 'offer', sdp: 'fake sdp'};

  const resetEmittedEvents = () => {
    emittedEvents[Events.resultReady].length = 0;
    emittedEvents[Events.clientMediaIpsUpdated].length = 0;
  };
  beforeEach(() => {
    fakePeerConnection = {
      createOffer: sinon.stub().resolves(FAKE_OFFER),
      setLocalDescription: sinon.stub().resolves(),
      close: sinon.stub(),
      iceGatheringState: 'new',
      getStats: sinon.stub().resolves([]),
    };

    previousRTCPeerConnection = global.RTCPeerConnection;
    global.RTCPeerConnection = sinon.stub().returns(fakePeerConnection);

    clusterReachability = new ClusterReachability('testName', {
      isVideoMesh: false,
      udp: ['stun:udp1', 'stun:udp2'],
      tcp: ['stun:tcp1.webex.com', 'stun:tcp2.webex.com:5004'],
      xtls: ['stun:xtls1.webex.com', 'stun:xtls2.webex.com:443'],
    });

    resetEmittedEvents();

    clusterReachability.on(Events.resultReady, (data: ResultEventData) => {
      emittedEvents[Events.resultReady].push(data);
    });

    clusterReachability.on(Events.clientMediaIpsUpdated, (data: ClientMediaIpsUpdatedEventData) => {
      emittedEvents[Events.clientMediaIpsUpdated].push(data);
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
    });

    assert.calledOnceWithExactly(global.RTCPeerConnection, {
      iceServers: [],
      iceCandidatePoolSize: 0,
      iceTransportPolicy: 'all',
    });
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

      // check that the right webrtc APIs are called
      assert.calledOnceWithExactly(fakePeerConnection.createOffer, {offerToReceiveAudio: true});
      assert.calledOnce(fakePeerConnection.setLocalDescription);

      clusterReachability.abort();
      await promise;

      // verify that no events were emitted
      assert.deepEqual(emittedEvents[Events.resultReady], []);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);
    });

    it('resolves and has correct result as soon as it finds that all udp, tcp and tls are reachable', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp'}});

      await testUtils.flushPromises();

      // check the right events were emitted
      assert.equal(emittedEvents[Events.resultReady].length, 1);
      assert.deepEqual(emittedEvents[Events.resultReady][0], {
        protocol: 'udp',
        result: 'reachable',
        latencyInMilliseconds: 100,
        clientMediaIPs: ['somePublicIp'],
      });

      // clientMediaIpsUpdated shouldn't be emitted, because the IP is already passed in the resultReady event
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});

      // check the right event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 2);
      assert.deepEqual(emittedEvents[Events.resultReady][1], {
        protocol: 'tcp',
        result: 'reachable',
        latencyInMilliseconds: 200,
      });
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

      // check the right event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 3);
      assert.deepEqual(emittedEvents[Events.resultReady][2], {
        protocol: 'xtls',
        result: 'reachable',
        latencyInMilliseconds: 300,
      });
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['somePublicIp']},
        tcp: {result: 'reachable', latencyInMilliseconds: 200},
        xtls: {result: 'reachable', latencyInMilliseconds: 300},
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

      await testUtils.flushPromises();

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

    it('resolves when ICE gathering is completed', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      fakePeerConnection.iceConnectionState = 'complete';
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

      fakePeerConnection.iceConnectionState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 30, clientMediaIPs: ['somePublicIp1']},
        tcp: {result: 'unreachable'},
        xtls: {result: 'unreachable'},
      });
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
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp1'}});

      // generate more candidates
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp2'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp3'}});

      clusterReachability.abort();
      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from only from UDP candidates
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

      await testUtils.flushPromises();

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

      await testUtils.flushPromises();

      // no new event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 0);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      await testUtils.flushPromises();

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

      await testUtils.flushPromises();

      // no new event was emitted
      assert.equal(emittedEvents[Events.resultReady].length, 0);
      assert.equal(emittedEvents[Events.clientMediaIpsUpdated].length, 0);

      // send also a relay candidate so that the reachability check finishes
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});
      fakePeerConnection.onicecandidate({
        candidate: {type: 'relay', address: 'someTurnRelayIp', port: 443},
      });

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
  });
});
