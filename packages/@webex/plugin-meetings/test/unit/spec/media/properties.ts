import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MediaProperties from '@webex/plugin-meetings/src/media/properties';
import MediaUtil from '@webex/plugin-meetings/src/media/util';
import testUtils from '../../../utils/testUtils';
import {PC_BAIL_TIMEOUT} from '@webex/plugin-meetings/src/constants';
import {Defer} from '@webex/common';

describe('MediaProperties', () => {
  let mediaProperties;
  let mockPc;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mockPc = {
      getStats: sinon.stub().resolves([]),
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      iceConnectionState: 'connected',
    };

    sinon.stub(MediaUtil, 'createPeerConnection').returns(mockPc);

    mediaProperties = new MediaProperties();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });
  describe('waitForIceConnectedState', () => {
    it('resolves immediately if ice state is connected', async () => {
      mockPc.iceConnectionState = 'connected';

      await mediaProperties.waitForIceConnectedState();
    });
    it('resolves immediately if ice state is completed', async () => {
      mockPc.iceConnectionState = 'completed';

      await mediaProperties.waitForIceConnectedState();
    });
    it('rejects after timeout if ice state does not reach connected/completed', async () => {
      mockPc.iceConnectionState = 'connecting';

      let promiseResolved = false;
      let promiseRejected = false;

      mediaProperties
        .waitForIceConnectedState()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      await clock.tickAsync(PC_BAIL_TIMEOUT);
      await testUtils.flushPromises();

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, true);

      // check that listener was registered and removed
      assert.calledOnce(mockPc.addEventListener);
      assert.equal(mockPc.addEventListener.getCall(0).args[0], 'iceconnectionstatechange');
      const listener = mockPc.addEventListener.getCall(0).args[1];

      assert.calledOnce(mockPc.removeEventListener);
      assert.calledWith(mockPc.removeEventListener, 'iceconnectionstatechange', listener);
    });

    ['connected', 'completed'].forEach((successIceState) =>
      it(`resolves when ice state reaches ${successIceState}`, async () => {
        mockPc.iceConnectionState = 'connecting';

        const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

        let promiseResolved = false;
        let promiseRejected = false;

        mediaProperties
          .waitForIceConnectedState()
          .then(() => {
            promiseResolved = true;
          })
          .catch(() => {
            promiseRejected = true;
          });

        assert.equal(promiseResolved, false);
        assert.equal(promiseRejected, false);

        // check the right listener was registered
        assert.calledOnce(mockPc.addEventListener);
        assert.equal(mockPc.addEventListener.getCall(0).args[0], 'iceconnectionstatechange');
        const listener = mockPc.addEventListener.getCall(0).args[1];

        // call the listener and pretend we are now connected
        mockPc.iceConnectionState = successIceState;
        listener();
        await testUtils.flushPromises();

        assert.equal(promiseResolved, true);
        assert.equal(promiseRejected, false);

        // check that listener was removed
        assert.calledOnce(mockPc.removeEventListener);
        assert.calledWith(mockPc.removeEventListener, 'iceconnectionstatechange', listener);

        assert.calledOnce(clearTimeoutSpy);
      })
    );
  });

  describe('getCurrentConnectionType', () => {
    it('calls waitForIceConnectedState', async () => {
      const spy = sinon.stub(mediaProperties, 'waitForIceConnectedState');

      await mediaProperties.getCurrentConnectionType();

      assert.calledOnce(spy);
    });
    it('calls getStats() only after waitForIceConnectedState resolves', async () => {
      const waitForIceConnectedStateResult = new Defer();

      const waitForIceConnectedStateStub = sinon
        .stub(mediaProperties, 'waitForIceConnectedState')
        .returns(waitForIceConnectedStateResult.promise);

      const result = mediaProperties.getCurrentConnectionType();

      await testUtils.flushPromises();

      assert.called(waitForIceConnectedStateStub);
      assert.notCalled(mockPc.getStats);

      waitForIceConnectedStateResult.resolve();
      await testUtils.flushPromises();

      assert.called(mockPc.getStats);
      await result;
    });
    it('rejects if waitForIceConnectedState rejects', async () => {
      const waitForIceConnectedStateResult = new Defer();

      const waitForIceConnectedStateStub = sinon
        .stub(mediaProperties, 'waitForIceConnectedState')
        .returns(waitForIceConnectedStateResult.promise);

      const result = mediaProperties.getCurrentConnectionType();

      await testUtils.flushPromises();

      assert.called(waitForIceConnectedStateStub);

      waitForIceConnectedStateResult.reject(new Error('fake error'));
      await testUtils.flushPromises();

      assert.notCalled(mockPc.getStats);

      await assert.isRejected(result);
    });
    it('returns "unknown" if getStats() fails', async () => {
      mockPc.getStats.rejects(new Error());

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "unknown" if getStats() returns no candidate pairs', async () => {
      mockPc.getStats.resolves([{type: 'something', id: '1234'}]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "unknown" if getStats() returns no successful candidate pair', async () => {
      mockPc.getStats.resolves([{type: 'candidate-pair', id: '1234', state: 'inprogress'}]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "unknown" if getStats() returns a successful candidate pair but local candidate is missing', async () => {
      mockPc.getStats.resolves([
        {type: 'candidate-pair', id: '1234', state: 'succeeded', localCandidateId: 'wrong id'},
      ]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "UDP" if getStats() returns a successful candidate pair with udp local candidate', async () => {
      mockPc.getStats.resolves([
        {
          type: 'candidate-pair',
          id: 'some candidate pair id',
          state: 'succeeded',
          localCandidateId: 'local candidate id',
        },
        {type: 'local-candidate', id: 'some other candidate id', protocol: 'tcp'},
        {type: 'local-candidate', id: 'local candidate id', protocol: 'udp'},
      ]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'UDP');
    });

    it('returns "TCP" if getStats() returns a successful candidate pair with tcp local candidate', async () => {
      mockPc.getStats.resolves([
        {
          type: 'candidate-pair',
          id: 'some candidate pair id',
          state: 'succeeded',
          localCandidateId: 'some candidate id',
        },
        {type: 'local-candidate', id: 'some other candidate id', protocol: 'udp'},
        {type: 'local-candidate', id: 'some candidate id', protocol: 'tcp'},
      ]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'TCP');
    });

    [
      {relayProtocol: 'tls', expectedConnectionType: 'TURN-TLS'},
      {relayProtocol: 'tcp', expectedConnectionType: 'TURN-TCP'},
      {relayProtocol: 'udp', expectedConnectionType: 'TURN-UDP'},
    ].forEach(({relayProtocol, expectedConnectionType}) =>
      it(`returns "${expectedConnectionType}" if getStats() returns a successful candidate pair with a local candidate with relayProtocol=${relayProtocol}`, async () => {
        mockPc.getStats.resolves([
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

        const connectionType = await mediaProperties.getCurrentConnectionType();
        assert.equal(connectionType, expectedConnectionType);
      })
    );

    it('returns connection type of the first successful candidate pair', async () => {
      // in real life this will never happen and all active candidate pairs will have same transport,
      // but here we're simulating a situation where they have different transports and just checking
      // that the code still works and just returns the first one
      mockPc.getStats.resolves([
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

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'TURN-TLS');
    });
  });
});
