import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import testUtils from '../../../utils/testUtils';

// packages/@webex/plugin-meetings/test/unit/spec/reachability/clusterReachability.ts
import { ClusterReachability } from '@webex/plugin-meetings/src/reachability/clusterReachability'; // replace with actual path

describe('ClusterReachability', () => {
  let previousRTCPeerConnection;
  let clusterReachability;
  let fakePeerConnection;

  const FAKE_OFFER = {type: 'offer', sdp: 'fake sdp'};

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
      xtls: ['xtls1', 'xtls2'],
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
        {username: 'webexturnreachuser', credential: 'webexturnreachpwd', urls: ['turn:tcp1.webex.com?transport=tcp']},
        {username: 'webexturnreachuser', credential: 'webexturnreachpwd', urls: ['turn:tcp2.webex.com:5004?transport=tcp']}
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
      xtls: {result: 'untested'}
    });
  });

  describe('#start', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    })

    it('should initiate the ICE gathering process', async () => {
      const promise = clusterReachability.start();

      await testUtils.flushPromises();

      // check that the right listeners are setup
      assert.isFunction(fakePeerConnection.onicecandidate);
      assert.isFunction(fakePeerConnection.onicegatheringstatechange);

      // check that the right webrtc APIs are called
      assert.calledOnceWithExactly(fakePeerConnection.createOffer, {offerToReceiveAudio: true});
      assert.calledOnce(fakePeerConnection.setLocalDescription);

      await clock.tickAsync(3000);// move the clock so that reachability times out
      await promise;
    });

    it('resolves and has correct result as soon as it finds that both udp and tcp is reachable', async () => {
      const promise = clusterReachability.start();

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp'}});

      await clock.tickAsync(100);
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});

      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 100, clientMediaIPs: ['somePublicIp']},
        tcp: {result: 'reachable', latencyInMilliseconds: 200},
        xtls: {result: 'untested'}
      });
    });

    it('times out correctly', async () => {
      const promise = clusterReachability.start();

      // progress time without any candidates
      await clock.tickAsync(3000);
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'unreachable'},
        xtls: {result: 'untested'}
      });
    });

    it('times out correctly for video mesh nodes', async () => {
      clusterReachability = new ClusterReachability('testName', {
        isVideoMesh: true,
        udp: ['stun:udp1', 'stun:udp2'],
        tcp: ['stun:tcp1.webex.com', 'stun:tcp2.webex.com:5004'],
        xtls: ['xtls1', 'xtls2'],
      });

      const promise = clusterReachability.start();

      // video mesh nodes have shorter timeout of just 1s
      await clock.tickAsync(1000);
      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'unreachable'},
        xtls: {result: 'untested'}
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
        xtls: {result: 'untested'}
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
        xtls: {result: 'untested'}
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

      await clock.tickAsync(3000);// move the clock so that reachability times out

      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from all UDP candidates (not TCP)
      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 10, clientMediaIPs: ['somePublicIp1', 'somePublicIp2', 'somePublicIp3']},
        tcp: {result: 'unreachable'},
        xtls: {result: 'untested'}
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

      await clock.tickAsync(3000);// move the clock so that reachability times out

      await promise;

      // latency should be from only the first candidates, but the clientMediaIps should be from only from UDP candidates
      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'unreachable'},
        tcp: {result: 'reachable', latencyInMilliseconds: 10},
        xtls: {result: 'untested'}
      });
    });

    it('ignores duplicate clientMediaIps', async () => {
      const promise = clusterReachability.start();

      // generate candidates with duplicate addresses
      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp1'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      await clock.tickAsync(10);
      fakePeerConnection.onicecandidate({candidate: {type: 'srflx', address: 'somePublicIp2'}});

      // send also a relay candidate so that the reachability check finishes
      fakePeerConnection.onicecandidate({candidate: {type: 'relay', address: 'someTurnRelayIp'}});

      await promise;

      assert.deepEqual(clusterReachability.getResult(), {
        udp: {result: 'reachable', latencyInMilliseconds: 10, clientMediaIPs: ['somePublicIp1', 'somePublicIp2']},
        tcp: {result: 'reachable', latencyInMilliseconds: 40},
        xtls: {result: 'untested'}
      });
    });
  });
});
