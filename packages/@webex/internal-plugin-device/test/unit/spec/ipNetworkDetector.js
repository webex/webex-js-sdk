import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import IpNetworkDetector from '@webex/internal-plugin-device/src/ipNetworkDetector';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-device', () => {
  describe('IpNetworkDetector', () => {
    let webex;
    let ipNetworkDetector;

    beforeEach(() => {
      webex = new MockWebex({});

      ipNetworkDetector = new IpNetworkDetector({}, {parent: webex});
    });

    it('is initialized correctly', () => {
      assert.equal(ipNetworkDetector.supportsIpV4, undefined);
      assert.equal(ipNetworkDetector.supportsIpV6, undefined);
      assert.equal(ipNetworkDetector.firstIpV4, -1);
      assert.equal(ipNetworkDetector.firstIpV6, -1);
      assert.equal(ipNetworkDetector.firstMdns, -1);
      assert.equal(ipNetworkDetector.totalTime, -1);
    });

    describe('detect', () => {
      let previousRTCPeerConnection;
      let clock;
      let fakePeerConnection;

      const FAKE_OFFER = {type: 'offer', sdp: 'some sdp'};

      beforeEach(() => {
        clock = sinon.useFakeTimers();

        previousRTCPeerConnection = global.RTCPeerConnection;

        fakePeerConnection = {
          createDataChannel: sinon.stub(),
          createOffer: sinon.stub().resolves(FAKE_OFFER),
          setLocalDescription: sinon.stub().resolves(),
          close: sinon.stub(),
          iceGatheringState: 'new',
        };
        global.RTCPeerConnection = sinon.stub().returns(fakePeerConnection);
      });

      afterEach(() => {
        global.RTCPeerConnection = previousRTCPeerConnection;
        clock.restore();
      });

      const simulateCandidate = (delay, address) => {
        clock.tick(delay);

        fakePeerConnection.onicecandidate({
          candidate: {address},
        });
      };

      const simulateEndOfCandidateGathering = (delay, useGatheringStateChange = true) => {
        clock.tick(delay);

        // browsers have 2 ways of notifying about ICE candidate gathering being completed
        // 1. through gathering state change
        // 2. by sending a null candidate
        if (useGatheringStateChange) {
          fakePeerConnection.iceGatheringState = 'complete';
          fakePeerConnection.onicegatheringstatechange();
        } else {
          fakePeerConnection.onicecandidate({
            candidate: null,
          });
        }
      };

      const checkResults = (expectedResults) => {
        assert.equal(ipNetworkDetector.supportsIpV4, expectedResults.supportsIpV4);
        assert.equal(ipNetworkDetector.supportsIpV6, expectedResults.supportsIpV6);
        assert.equal(ipNetworkDetector.firstIpV4, expectedResults.timings.ipv4);
        assert.equal(ipNetworkDetector.firstIpV6, expectedResults.timings.ipv6);
        assert.equal(ipNetworkDetector.firstMdns, expectedResults.timings.mdns);
        assert.equal(ipNetworkDetector.totalTime, expectedResults.timings.totalTime);
      };

      it('creates an RTCPeerConnection with a data channel and does ice candidate gathering', async () => {
        const promise = ipNetworkDetector.detect();

        simulateEndOfCandidateGathering();

        await promise;

        assert.calledOnceWithExactly(fakePeerConnection.createDataChannel, 'data');
        assert.calledOnceWithExactly(fakePeerConnection.createOffer);
        assert.calledOnceWithExactly(fakePeerConnection.setLocalDescription, FAKE_OFFER);
      });

      it('works correctly when we get only ipv4 candidates', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(70, '192.168.0.1');
        simulateCandidate(30, '192.168.16.1');
        simulateEndOfCandidateGathering(50);

        await promise;

        checkResults({
          supportsIpV4: true,
          supportsIpV6: false,
          timings: {
            totalTime: 150,
            ipv4: 70, // this should match the first ipv4 candidate's delay
            ipv6: -1,
            mdns: -1,
          },
        });
      });

      it('works correctly when we get only ipv6 candidates (chrome, safari)', async () => {
        const promise = ipNetworkDetector.detect();

        // chrome and safari for some reason wrap the ipv6 addresses with []
        simulateCandidate(150, '[2a02:c7c:a0d0:8a00:db9b:d4de:d1f7:4c49]');
        simulateCandidate(50, '[2a02:c7c:a0d0:8a00:d089:7baf:ceef:b9d8]');
        simulateEndOfCandidateGathering(100);

        await promise;

        checkResults({
          supportsIpV4: false,
          supportsIpV6: true,
          timings: {
            totalTime: 300,
            ipv4: -1,
            ipv6: 150, // this should match the first ipv6 candidate's delay
            mdns: -1,
          },
        });
      });

      it('works correctly when we get only ipv6 candidates (Firefox)', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(150, '2a02:c7c:a0d0:8a00:db9b:d4de:d1f7:4c49');
        simulateCandidate(50, '2a02:c7c:a0d0:8a00:d089:7baf:ceef:b9d8');
        simulateEndOfCandidateGathering(100);

        await promise;

        checkResults({
          supportsIpV4: false,
          supportsIpV6: true,
          timings: {
            totalTime: 300,
            ipv4: -1,
            ipv6: 150, // this should match the first ipv6 candidate's delay
            mdns: -1,
          },
        });
      });

      it('works correctly when we get both ipv6 and ipv4 candidates', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(50, '2a02:c7c:a0d0:8a00:db9b:d4de:d1f7:4c49');
        simulateCandidate(50, '192.168.10.10');

        // at this point, as we've got at least 1 IPv4 and IPv6 candidate the promise should already be resolved
        await promise;

        checkResults({
          supportsIpV4: true,
          supportsIpV6: true,
          timings: {
            totalTime: -1, // ice gathering has not finished, so this one is still -1
            ipv4: 100,
            ipv6: 50,
            mdns: -1,
          },
        });

        // receiving any more candidates should not cause any problems
        simulateCandidate(50, '192.168.1.1');
        simulateCandidate(50, '2a02:c7c:a0d0:8a00:d089:7baf:ceef:b9d8');
        simulateEndOfCandidateGathering(100);

        // check final results haven't changed (except for totalTime)
        checkResults({
          supportsIpV4: true,
          supportsIpV6: true,
          timings: {
            totalTime: 300,
            ipv4: 100,
            ipv6: 50,
            mdns: -1,
          },
        });
      });

      it('works correctly when we get only mDNS candidates', async () => {
        const promise = ipNetworkDetector.detect();

        // simulate some mDNS candidates (this happens if we don't have user media permissions)
        simulateCandidate(50, '686a3cac-2840-4c62-9f85-9f0b03e84298.local');
        simulateCandidate(50, '12f3ab4a3-4741-48c8-b1c9-8dd93d123aa1.local');
        simulateEndOfCandidateGathering(100);

        await promise;

        checkResults({
          supportsIpV4: undefined,
          supportsIpV6: undefined,
          timings: {
            totalTime: 200,
            ipv4: -1,
            ipv6: -1,
            mdns: 50,
          },
        });
      });

      it('works correctly when we get no candidates at all', async () => {
        const promise = ipNetworkDetector.detect();

        simulateEndOfCandidateGathering(100);

        await promise;

        checkResults({
          supportsIpV4: false,
          supportsIpV6: false,
          timings: {
            totalTime: 100,
            ipv4: -1,
            ipv6: -1,
            mdns: -1,
          },
        });
      });

      // this never happens right now, but in theory browsers might change and if we get
      // mDNS candidates with IPv4, but without IPv6, it is probably safe to assume that we're only on IPv4 network
      it('works correctly when we get mDNS and ipv4 candidates', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(50, '686a3cac-2840-4c62-9f85-9f0b03e84298.local');
        simulateCandidate(50, '192.168.0.0');
        simulateEndOfCandidateGathering(100);

        await promise;

        checkResults({
          supportsIpV4: true,
          supportsIpV6: false,
          timings: {
            totalTime: 200,
            ipv4: 100,
            ipv6: -1,
            mdns: 50,
          },
        });
      });

      // this never happens right now, but in theory browsers might change and if we get
      // mDNS candidates with IPv6, but without IPv4, it is probably safe to assume that we're only on IPv6 network
      it('works correctly when we get mDNS and ipv6 candidates', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(50, '686a3cac-2840-4c62-9f85-9f0b03e84298.local');
        simulateCandidate(50, '2a02:c7c:a0d0:8a00:db9b:d4de:d1f7:4c49');
        simulateEndOfCandidateGathering(100);

        await promise;

        checkResults({
          supportsIpV4: false,
          supportsIpV6: true,
          timings: {
            totalTime: 200,
            ipv4: -1,
            ipv6: 100,
            mdns: 50,
          },
        });
      });

      it('works correctly when we get null candidate at the end instead of gathering state change event', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(50, '2a02:c7c:a0d0:8a00:db9b:d4de:d1f7:4c49');
        simulateCandidate(50, '192.168.10.10');
        simulateEndOfCandidateGathering(100, false);

        await promise;

        checkResults({
          supportsIpV4: true,
          supportsIpV6: true,
          timings: {
            totalTime: 200,
            ipv4: 100,
            ipv6: 50,
            mdns: -1,
          },
        });
      });

      it('resets all the props when called again', async () => {
        const promise = ipNetworkDetector.detect();

        simulateCandidate(50, '192.168.0.1');
        simulateCandidate(50, '2a02:c7c:a0d0:8a00:db9b:d4de:d1f7:4c49');
        simulateEndOfCandidateGathering(10);

        await promise;

        checkResults({
          supportsIpV4: true,
          supportsIpV6: true,
          timings: {
            totalTime: 110,
            ipv4: 50,
            ipv6: 100,
            mdns: -1,
          },
        });

        // now call detect() again
        const promise2 = ipNetworkDetector.detect();

        // everything should have been reset
        assert.equal(ipNetworkDetector.supportsIpV4, undefined);
        assert.equal(ipNetworkDetector.supportsIpV6, undefined);
        assert.equal(ipNetworkDetector.firstIpV4, -1);
        assert.equal(ipNetworkDetector.firstIpV6, -1);
        assert.equal(ipNetworkDetector.firstMdns, -1);
        assert.equal(ipNetworkDetector.totalTime, -1);

        simulateEndOfCandidateGathering(10);
        await promise2;
      });

      it('rejects if one of RTCPeerConnection operations fails', async () => {
        const fakeError = new Error('fake error');

        fakePeerConnection.createOffer.rejects(fakeError);

        await assert.isRejected(ipNetworkDetector.detect(), fakeError);

        assert.calledOnce(fakePeerConnection.close);
      });

      describe('while detection is in progress', () => {
        describe('supportsIpv4 prop', () => {
          it('returns undefined before any ipv4 candidate is received and true afterwards', async () => {
            const promise = ipNetworkDetector.detect();

            assert.equal(ipNetworkDetector.supportsIpV4, undefined);
            assert.equal(ipNetworkDetector.firstIpV4, -1);

            simulateCandidate(50, 'fd64:17cf:f4ad:0:d089:7baf:ceef:b9d8');
            // still no ipv4 candidates...
            assert.equal(ipNetworkDetector.supportsIpV4, undefined);
            assert.equal(ipNetworkDetector.firstIpV4, -1);

            simulateCandidate(50, '686a3cac-2840-4c62-9f85-9f0b03e84298.local');
            // still no ipv4 candidates...
            assert.equal(ipNetworkDetector.supportsIpV4, undefined);
            assert.equal(ipNetworkDetector.firstIpV4, -1);

            simulateCandidate(50, '192.168.0.0');
            // now we've got one
            assert.equal(ipNetworkDetector.supportsIpV4, true);
            assert.equal(ipNetworkDetector.firstIpV4, 150);

            simulateEndOfCandidateGathering(1);
            await promise;
          });
        });

        describe('supportsIpv6 prop', () => {
          it('returns undefined before any ipv6 candidate is received and true afterwards', async () => {
            const promise = ipNetworkDetector.detect();

            assert.equal(ipNetworkDetector.supportsIpV6, undefined);
            assert.equal(ipNetworkDetector.firstIpV6, -1);

            simulateCandidate(50, '192.168.0.0');
            // still no ipv6 candidates...
            assert.equal(ipNetworkDetector.supportsIpV6, undefined);
            assert.equal(ipNetworkDetector.firstIpV6, -1);

            simulateCandidate(50, '686a3cac-2860-6c62-9f85-9f0b03e86298.local');
            // still no ipv6 candidates...
            assert.equal(ipNetworkDetector.supportsIpV6, undefined);
            assert.equal(ipNetworkDetector.firstIpV6, -1);

            simulateCandidate(50, 'fd64:17cf:f4ad:0:d089:7baf:ceef:b9d8');
            // now we've got one
            assert.equal(ipNetworkDetector.supportsIpV6, true);
            assert.equal(ipNetworkDetector.firstIpV6, 150);

            simulateEndOfCandidateGathering(1);
            await promise;
          });
        });
      });
    });
  });
});
