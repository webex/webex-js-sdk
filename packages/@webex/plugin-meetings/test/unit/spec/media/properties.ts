import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {ConnectionState} from '@webex/internal-media-core';
import * as tsSdpModule from '@webex/ts-sdp';
import MediaProperties from '@webex/plugin-meetings/src/media/properties';
import {Defer} from '@webex/common';
import MediaConnectionAwaiter from '../../../../src/media/MediaConnectionAwaiter';

describe('MediaProperties', () => {
  let mediaProperties;
  let mockMC;
  let clock;
  let rtcPeerConnection;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    rtcPeerConnection = {
      localDescription: {sdp: ''},
    };

    mockMC = {
      getStats: sinon.stub().resolves([]),
      on: sinon.stub(),
      off: sinon.stub(),
      getConnectionState: sinon.stub().returns(ConnectionState.Connected),
      multistreamConnection: {pc: {pc: rtcPeerConnection}},
    };

    mediaProperties = new MediaProperties();
    mediaProperties.setMediaPeerConnection(mockMC);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });
  describe('waitForMediaConnectionConnected', () => {
    it('resolves if media connection is connected', async () => {
      const waitForMediaConnectionConnectedResult = new Defer();

      sinon
        .stub(MediaConnectionAwaiter.prototype, 'waitForMediaConnectionConnected')
        .returns(waitForMediaConnectionConnectedResult.promise);

      waitForMediaConnectionConnectedResult.resolve();

      await mediaProperties.waitForMediaConnectionConnected();
    });
    it('rejects if media connection is not connected', async () => {
      const waitForMediaConnectionConnectedResult = new Defer();

      sinon
        .stub(MediaConnectionAwaiter.prototype, 'waitForMediaConnectionConnected')
        .returns(waitForMediaConnectionConnectedResult.promise);

      waitForMediaConnectionConnectedResult.reject();

      await assert.isRejected(mediaProperties.waitForMediaConnectionConnected());
    });
  });

  describe('getCurrentConnectionInfo', () => {
    it('handles the case when getStats() fails', async () => {
      mockMC.getStats.rejects(new Error());

      const {connectionType, selectedCandidatePairChanges, numTransports} =
        await mediaProperties.getCurrentConnectionInfo();

      assert.equal(connectionType, 'unknown');
      assert.equal(selectedCandidatePairChanges, -1);
      assert.equal(numTransports, 0);
    });

    it('handles time out in the case when getStats() is not resolving', async () => {
      // Promise that never resolves
      mockMC.getStats = new Promise(() => {});

      const promise = mediaProperties.getCurrentConnectionInfo();

      await clock.tickAsync(1000);

      const {connectionType, selectedCandidatePairChanges, numTransports} = await promise;

      assert.equal(connectionType, 'unknown');
      assert.equal(selectedCandidatePairChanges, -1);
      assert.equal(numTransports, 0);
    });

    describe('ipVersion', () => {
      it('returns ipVersion=undefined if getStats() returns no candidate pairs', async () => {
        mockMC.getStats.resolves([{type: 'something', id: '1234'}]);
        const info = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(info.ipVersion, undefined);
      });

      it('returns ipVersion=undefined if getStats() returns no selected candidate pair', async () => {
        mockMC.getStats.resolves([{type: 'candidate-pair', id: '1234', selected: false}]);
        const info = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(info.ipVersion, undefined);
      });

      it('returns ipVersion="IPv4" if transport has selectedCandidatePairId and local candidate has IPv4 address', async () => {
        mockMC.getStats.resolves([
          {type: 'transport', id: 't1', selectedCandidatePairId: 'cp1'},
          {type: 'candidate-pair', id: 'cp1', localCandidateId: 'lc1'},
          {type: 'local-candidate', id: 'lc1', address: '192.168.1.1'},
        ]);
        const info = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(info.ipVersion, 'IPv4');
      });

      it('returns ipVersion="IPv6" if transport has selectedCandidatePairId and local candidate has IPv6 address', async () => {
        mockMC.getStats.resolves([
          {type: 'transport', id: 't1', selectedCandidatePairId: 'cp1'},
          {type: 'candidate-pair', id: 'cp1', localCandidateId: 'lc1'},
          {type: 'local-candidate', id: 'lc1', address: 'fd8f:12e6:5e53:784f:a0ba:f8d5:b906:1acc'},
        ]);
        const info = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(info.ipVersion, 'IPv6');
      });

      it('returns ipVersion="IPv4" if transport has no selectedCandidatePairId but finds selected candidate pair and local candidate has IPv4 address', async () => {
        mockMC.getStats.resolves([
          {type: 'transport', id: 't1'},
          {type: 'candidate-pair', id: 'cp2', localCandidateId: 'lc2', selected: true},
          {type: 'local-candidate', id: 'lc2', address: '10.0.0.1'},
        ]);
        const info = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(info.ipVersion, 'IPv4');
      });

      it('returns ipVersion="IPv6" if transport has no selectedCandidatePairId but finds selected candidate pair and local candidate has IPv6 address', async () => {
        mockMC.getStats.resolves([
          {type: 'transport', id: 't1'},
          {type: 'candidate-pair', id: 'cp2', localCandidateId: 'lc2', selected: true},
          {type: 'local-candidate', id: 'lc2', address: 'fe80::1ff:fe23:4567:890a'},
        ]);
        const info = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(info.ipVersion, 'IPv6');
      });

      describe('local candidate without address', () => {
        it('return="IPv4" if candidate from SDP with matching port number has IPv4 address', async () => {
          sinon.stub(tsSdpModule, 'parse').returns({
            avMedia: [
              {
                iceInfo: {
                  candidates: [
                    {
                      port: 1234,
                      connectionAddress: '192.168.0.1',
                    },
                  ],
                },
              },
            ],
          });

          mockMC.getStats.resolves([
            {type: 'transport', id: 't1'},
            {type: 'candidate-pair', id: 'cp2', localCandidateId: 'lc2', selected: true},
            {type: 'local-candidate', id: 'lc2', port: 1234},
          ]);
          const info = await mediaProperties.getCurrentConnectionInfo();
          assert.equal(info.ipVersion, 'IPv4');

          assert.calledWith(tsSdpModule.parse, rtcPeerConnection.localDescription.sdp);
        });

        it('returns ipVersion="IPv6" if candidate from SDP with matching port number has IPv6 address', async () => {
          sinon.stub(tsSdpModule, 'parse').returns({
            avMedia: [
              {
                iceInfo: {
                  candidates: [
                    {
                      port: 5000,
                      connectionAddress: 'fe80::1ff:fe23:4567:890a',
                    },
                  ],
                },
              },
            ],
          });

          mockMC.getStats.resolves([
            {type: 'transport', id: 't1'},
            {type: 'candidate-pair', id: 'cp2', localCandidateId: 'lc2', selected: true},
            {type: 'local-candidate', id: 'lc2', port: 5000},
          ]);
          const info = await mediaProperties.getCurrentConnectionInfo();
          assert.equal(info.ipVersion, 'IPv6');

          assert.calledWith(tsSdpModule.parse, rtcPeerConnection.localDescription.sdp);
        });

        it('returns ipVersion=undefined if parsing of the SDP fails', async () => {
          sinon.stub(tsSdpModule, 'parse').throws(new Error('fake error'));

          mockMC.getStats.resolves([
            {type: 'candidate-pair', id: 'cp2', localCandidateId: 'lc2', selected: true},
            {type: 'local-candidate', id: 'lc2', port: 5000},
          ]);
          const info = await mediaProperties.getCurrentConnectionInfo();
          assert.equal(info.ipVersion, undefined);

          assert.calledWith(tsSdpModule.parse, rtcPeerConnection.localDescription.sdp);
        });
      });
    });

    describe('selectedCandidatePairChanges and numTransports', () => {
      it('returns correct values when getStats() returns no transport stats at all', async () => {
        mockMC.getStats.resolves([{type: 'something', id: '1234'}]);

        const {selectedCandidatePairChanges, numTransports} =
          await mediaProperties.getCurrentConnectionInfo();

        assert.equal(selectedCandidatePairChanges, -1);
        assert.equal(numTransports, 0);
      });

      it('returns correct values when getStats() returns transport stats without selectedCandidatePairChanges', async () => {
        mockMC.getStats.resolves([{type: 'transport', id: '1234'}]);

        const {selectedCandidatePairChanges, numTransports} =
          await mediaProperties.getCurrentConnectionInfo();

        assert.equal(selectedCandidatePairChanges, -1);
        assert.equal(numTransports, 1);
      });

      it('returns correct values when getStats() returns transport stats with selectedCandidatePairChanges', async () => {
        mockMC.getStats.resolves([
          {type: 'transport', id: '1234', selectedCandidatePairChanges: 13},
        ]);

        const {selectedCandidatePairChanges, numTransports} =
          await mediaProperties.getCurrentConnectionInfo();

        assert.equal(selectedCandidatePairChanges, 13);
        assert.equal(numTransports, 1);
      });

      it('returns correct values when getStats() returns multiple transport stats', async () => {
        mockMC.getStats.resolves([
          {type: 'transport', id: '1', selectedCandidatePairChanges: 11},
          {type: 'transport', id: '2', selectedCandidatePairChanges: 12},
        ]);

        const {selectedCandidatePairChanges, numTransports} =
          await mediaProperties.getCurrentConnectionInfo();

        assert.equal(selectedCandidatePairChanges, 11); // we expect stats from the first transport to be returned
        assert.equal(numTransports, 2);
      });
    });
    describe('connectionType', () => {
      it('returns "unknown" if getStats() returns no candidate pairs', async () => {
        mockMC.getStats.resolves([{type: 'something', id: '1234'}]);

        const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(connectionType, 'unknown');
      });

      it('returns "unknown" if getStats() returns no successful candidate pair', async () => {
        mockMC.getStats.resolves([{type: 'candidate-pair', id: '1234', state: 'inprogress'}]);

        const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(connectionType, 'unknown');
      });

      it('returns "unknown" if getStats() returns a successful candidate pair but local candidate is missing', async () => {
        mockMC.getStats.resolves([
          {type: 'candidate-pair', id: '1234', state: 'succeeded', localCandidateId: 'wrong id'},
        ]);

        const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(connectionType, 'unknown');
      });

      it('returns "UDP" if getStats() returns a successful candidate pair with udp local candidate', async () => {
        mockMC.getStats.resolves([
          {
            type: 'candidate-pair',
            id: 'some candidate pair id',
            state: 'succeeded',
            localCandidateId: 'local candidate id',
          },
          {type: 'local-candidate', id: 'some other candidate id', protocol: 'tcp'},
          {type: 'local-candidate', id: 'local candidate id', protocol: 'udp'},
        ]);

        const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(connectionType, 'UDP');
      });

      it('returns "TCP" if getStats() returns a successful candidate pair with tcp local candidate', async () => {
        mockMC.getStats.resolves([
          {
            type: 'candidate-pair',
            id: 'some candidate pair id',
            state: 'succeeded',
            localCandidateId: 'some candidate id',
          },
          {type: 'local-candidate', id: 'some other candidate id', protocol: 'udp'},
          {type: 'local-candidate', id: 'some candidate id', protocol: 'tcp'},
        ]);

        const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(connectionType, 'TCP');
      });

      [
        {relayProtocol: 'tls', expectedConnectionType: 'TURN-TLS'},
        {relayProtocol: 'tcp', expectedConnectionType: 'TURN-TCP'},
        {relayProtocol: 'udp', expectedConnectionType: 'TURN-UDP'},
      ].forEach(({relayProtocol, expectedConnectionType}) =>
        it(`returns "${expectedConnectionType}" if getStats() returns a successful candidate pair with a local candidate with relayProtocol=${relayProtocol}`, async () => {
          mockMC.getStats.resolves([
            {
              type: 'candidate-pair',
              id: 'some candidate pair id',
              state: 'succeeded',
              localCandidateId: 'selected candidate id',
            },
            {
              type: 'candidate-pair',
              id: 'some other candidate pair id',
              state: 'failed',
              localCandidateId: 'some other candidate id 1',
            },
            {type: 'local-candidate', id: 'some other candidate id 1', protocol: 'udp'},
            {type: 'local-candidate', id: 'some other candidate id 2', protocol: 'tcp'},
            {
              type: 'local-candidate',
              id: 'selected candidate id',
              protocol: 'udp',
              relayProtocol,
            },
          ]);

          const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
          assert.equal(connectionType, expectedConnectionType);
        })
      );

      it('returns connection type of the first successful candidate pair', async () => {
        // in real life this will never happen and all active candidate pairs will have same transport,
        // but here we're simulating a situation where they have different transports and just checking
        // that the code still works and just returns the first one
        mockMC.getStats.resolves([
          {
            type: 'inbound-rtp',
            id: 'whatever',
          },
          {
            type: 'candidate-pair',
            id: 'some candidate pair id',
            state: 'succeeded',
            localCandidateId: '1st selected candidate id',
          },
          {
            type: 'candidate-pair',
            id: 'some other candidate pair id',
            state: 'succeeded',
            localCandidateId: '2nd selected candidate id',
          },
          {type: 'local-candidate', id: 'some other candidate id 1', protocol: 'udp'},
          {type: 'local-candidate', id: 'some other candidate id 2', protocol: 'tcp'},
          {
            type: 'local-candidate',
            id: '1st selected candidate id',
            protocol: 'udp',
            relayProtocol: 'tls',
          },
          {
            type: 'local-candidate',
            id: '2nd selected candidate id',
            protocol: 'udp',
            relayProtocol: 'tcp',
          },
        ]);

        const {connectionType} = await mediaProperties.getCurrentConnectionInfo();
        assert.equal(connectionType, 'TURN-TLS');
      });
    });
  });
});
