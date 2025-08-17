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
} from '@webex/plugin-meetings/src/reachability/clusterReachability'; // replace with actual path
import { NatType } from 'packages/@webex/plugin-meetings/dist/reachability/reachability.types';

describe('ClusterReachability', () => {
  let previousRTCPeerConnection;
  let clusterReachability;
  let fakePeerConnection;
  let gatherIceCandidatesSpy;

  const emittedEvents: Record<Events, (ResultEventData | ClientMediaIpsUpdatedEventData | NatTypeUpdatedEventData)[]> = {
    [Events.resultReady]: [],
    [Events.clientMediaIpsUpdated]: [],
    [Events.natTypeUpdated]: [],
    [Events.resultDetailsUpdated]: [],
  };
  const FAKE_OFFER = {type: 'offer', sdp: 'fake sdp'};

  const resetEmittedEvents = () => {
    emittedEvents[Events.resultReady].length = 0;
    emittedEvents[Events.clientMediaIpsUpdated].length = 0;
    emittedEvents[Events.natTypeUpdated].length = 0;
    emittedEvents[Events.resultDetailsUpdated].length = 0;
  };
  beforeEach(() => {
    fakePeerConnection = {
      createOffer: sinon.stub().resolves(FAKE_OFFER),
      setLocalDescription: sinon.stub().resolves(),
      close: sinon.stub(),
      iceGatheringState: 'new',
      onicecandidate: () => {},
      onicegatheringstatechange: () => {},
    };

    previousRTCPeerConnection = global.RTCPeerConnection;
    global.RTCPeerConnection = sinon.stub().returns(fakePeerConnection);
    // Reset stub history for createOffer and setLocalDescription
    fakePeerConnection.createOffer.resetHistory();
    fakePeerConnection.setLocalDescription.resetHistory();

    clusterReachability = new ClusterReachability('testName', {
      isVideoMesh: false,
      udp: ['stun:udp1', 'stun:udp2'],
      tcp: ['stun:tcp1.webex.com', 'stun:tcp2.webex.com:5004'],
      xtls: ['stun:xtls1.webex.com', 'stun:xtls2.webex.com:443'],
    });

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

    clusterReachability.on(Events.resultDetailsUpdated, (data: ResultEventData) => {
      emittedEvents[Events.resultDetailsUpdated].push(data);
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
    assert.equal(clusterReachability.numXTlsUrls, 2);
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

    it('resolves and returns correct results when aborted before it gets any candidates', async () => {
      const promise = clusterReachability.start();

      // progress time without any candidates
      clusterReachability.abort();
      await promise;

      // verify that no events were emitted
      assert.deepEqual(emittedEvents[Events.resultReady], []);
      assert.deepEqual(emittedEvents[Events.clientMediaIpsUpdated], []);

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable', details: []},
        tcp: {result: 'unreachable', details: []},
        xtls: {result: 'unreachable', details: []},
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
        details: [
          {
            serverIp: 'somePublicIp',
            port: null,
            'answered-tx': 1,
            'lost-tx': 0,
            latencies: [100]
          }
        ]
      });

      clusterReachability.abort();
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 100,
          clientMediaIPs: ['somePublicIp'],
          details: [
            {
              serverIp: 'somePublicIp',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [100]
            }
          ]
        },
        tcp: {result: 'unreachable', details: []},
        xtls: {result: 'unreachable', details: []},
      });
    });

    it('resolves when ICE gathering is completed', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      fakePeerConnection.iceGatheringState = 'complete';
      fakePeerConnection.onicegatheringstatechange();
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable', details: []},
        tcp: {result: 'unreachable', details: []},
        xtls: {result: 'unreachable', details: []},
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
        udp: {
          result: 'reachable',
          latencyInMilliseconds: 30,
          clientMediaIPs: ['somePublicIp1'],
          details: [
            {
              serverIp: 'somePublicIp1',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [30]
            }
          ]
        },
        tcp: {result: 'unreachable', details: []},
        xtls: {result: 'unreachable', details: []},
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
          details: [
            {
              serverIp: 'somePublicIp1',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [10]
            },
            {
              serverIp: 'somePublicIp2',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            },
            {
              serverIp: 'somePublicIp3',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [30]
            }
          ]
        },
        tcp: {result: 'unreachable', details: []},
        xtls: {result: 'unreachable', details: []}
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
        udp: {result: 'unreachable',  details: []},
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 10,
          details: [
            {
              serverIp: 'someTurnRelayIp1',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [10]
            },
            {
              serverIp: 'someTurnRelayIp2',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            },
            {
              serverIp: 'someTurnRelayIp3',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [30]
            }
          ]
        },
        xtls: {result: 'unreachable',  details: []},
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
        udp: {result: 'unreachable',  details: []},
        tcp: {result: 'unreachable', details: []},
        xtls: {
          result: 'reachable',
          latencyInMilliseconds: 10,
          details: [
            {
              serverIp: 'someTurnRelayIp1',
              port: 443,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [10]
            },
            {
              serverIp: 'someTurnRelayIp2',
              port: 443,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            },
            {
              serverIp: 'someTurnRelayIp3',
              port: 443,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [30]
            }
          ]
        }
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
        details: [
          {
            serverIp: 'somePublicIp1',
            port: null,
            'answered-tx': 1,
            'lost-tx': 0,
            latencies: [10]
          }
        ]
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
          details: [
            {
              serverIp: 'somePublicIp1',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            },
            {
              serverIp: 'somePublicIp2',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [40]
            }
          ]
        },
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 40,
          details: [
            {
              serverIp: 'someTurnRelayIp',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [40]
            }
          ]
        },
        xtls: {
          result: 'reachable',
          latencyInMilliseconds: 40,
          details: [
            {
              serverIp: 'someTurnRelayIp',
              port: 443,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [40]
            }
          ]
        }
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
          details: [
            {
              serverIp: 'somePublicIp1',
              port: 1000,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [10]
            },
            {
              serverIp: 'somePublicIp1',
              port: 2000,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            }
          ]
        },
        tcp: {
          result: 'reachable',
          latencyInMilliseconds: 20,
          details: [
            {
              serverIp: 'someTurnRelayIp',
              port: null,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            }
          ]
        },
        xtls: {
          result: 'reachable',
          latencyInMilliseconds: 20,
          details: [
            {
              serverIp: 'someTurnRelayIp',
              port: 443,
              'answered-tx': 1,
              'lost-tx': 0,
              latencies: [20]
            }
          ]
        }
      });
    });

    it('should gather correctly reached subnets in details', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:1.2.3.4:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:4.3.2.1:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});

      clusterReachability.abort();
      await promise;

      const udpDetails = clusterReachability.getResult().udp.details;
      const tcpDetails = clusterReachability.getResult().tcp.details;

      assert.sameMembers(
        udpDetails.map(d => d.serverIp),
        ['1.2.3.4', '4.3.2.1']
      );
      assert.include(
        tcpDetails.map(d => d.serverIp),
        'someTurnRelayIp'
      );
    });

    it('should store only unique subnet address in details', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:1.2.3.4:5004'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', url: 'stun:1.2.3.4:9000'}});
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: '1.2.3.4'}});

      clusterReachability.abort();
      await promise;

      const udpDetails = clusterReachability.getResult().udp.details;
      const tcpDetails = clusterReachability.getResult().tcp.details;

      assert.sameMembers(
        udpDetails.map(d => `${d.serverIp}:${d.port}`),
        ['1.2.3.4:5004', '1.2.3.4:9000']
      );
      assert.sameMembers(
        tcpDetails.map(d => d.serverIp),
        ['1.2.3.4']
      );
    });

    it('should not add duplicate details for the same (serverIp, port) pair', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: '1.2.3.4', port: 5004}});
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: '1.2.3.4', port: 5004}});

      clusterReachability.abort();
      await promise;

      const udpDetails = clusterReachability.getResult().udp.details;
      assert.lengthOf(udpDetails, 1);
      assert.deepEqual(udpDetails[0], {
        serverIp: '1.2.3.4',
        port: 5004,
        'answered-tx': 1,
        'lost-tx': 0,
        latencies: [20]
      });
    });

    it('should not set latency for failed subnets', async () => {
      clusterReachability.result.udp.details.push({
        serverIp: '2.2.2.2',
        port: 5004,
        'answered-tx': 0,
        'lost-tx': 1,
        latencies: [],
      });

      const udpDetails = clusterReachability.getResult().udp.details;
      const failed = udpDetails.find(d => d.serverIp === '2.2.2.2');
      assert.deepEqual(failed.latencies, []);
    });

    it('should set latency for successful subnets', async () => {
      // Simulate a successful subnet in details
      clusterReachability.result.udp.details.push({
        serverIp: '3.3.3.3',
        port: 5004,
        'answered-tx': 1,
        'lost-tx': 0,
        latencies: [123],
      });

      const udpDetails = clusterReachability.getResult().udp.details;
      const success = udpDetails.find(d => d.serverIp === '3.3.3.3');
      assert.deepEqual(success.latencies, [123]);
    });
  });
});
