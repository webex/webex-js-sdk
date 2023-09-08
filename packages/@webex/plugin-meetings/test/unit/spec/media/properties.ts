import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {ConnectionState, Event} from '@webex/internal-media-core';
import MediaProperties from '@webex/plugin-meetings/src/media/properties';
import MediaUtil from '@webex/plugin-meetings/src/media/util';
import testUtils from '../../../utils/testUtils';
import {PC_BAIL_TIMEOUT} from '@webex/plugin-meetings/src/constants';
import {Defer} from '@webex/common';

describe('MediaProperties', () => {
  let mediaProperties;
  let mockMC;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mockMC = {
      getStats: sinon.stub().resolves([]),
      on: sinon.stub(),
      off: sinon.stub(),
      getConnectionState: sinon.stub().returns(ConnectionState.Connected),
    };

    mediaProperties = new MediaProperties();
    mediaProperties.setMediaPeerConnection(mockMC);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });
  describe('waitForMediaConnectionConnected', () => {
    it('resolves immediately if ice state is connected', async () => {
      await mediaProperties.waitForMediaConnectionConnected();
    });
    it('rejects after timeout if ice state does not reach connected/completed', async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);

      let promiseResolved = false;
      let promiseRejected = false;

      mediaProperties
        .waitForMediaConnectionConnected()
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
      assert.calledOnce(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.CONNECTION_STATE_CHANGED);
      const listener = mockMC.on.getCall(0).args[1];

      assert.calledOnce(mockMC.off);
      assert.calledWith(mockMC.off, Event.CONNECTION_STATE_CHANGED, listener);
    });

    it(`resolves when media connection reaches "connected" state`, async () => {
      mockMC.getConnectionState.returns(ConnectionState.Connecting);

      const clearTimeoutSpy = sinon.spy(clock, 'clearTimeout');

      let promiseResolved = false;
      let promiseRejected = false;

      mediaProperties
        .waitForMediaConnectionConnected()
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      assert.equal(promiseResolved, false);
      assert.equal(promiseRejected, false);

      // check the right listener was registered
      assert.calledOnce(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.CONNECTION_STATE_CHANGED);
      const listener = mockMC.on.getCall(0).args[1];

      // call the listener and pretend we are now connected
      mockMC.getConnectionState.returns(ConnectionState.Connected);
      listener();
      await testUtils.flushPromises();

      assert.equal(promiseResolved, true);
      assert.equal(promiseRejected, false);

      // check that listener was removed
      assert.calledOnce(mockMC.off);
      assert.calledWith(mockMC.off, Event.CONNECTION_STATE_CHANGED, listener);

      assert.calledOnce(clearTimeoutSpy);
    });
  });

  describe('getCurrentConnectionType', () => {
    it('calls waitForMediaConnectionConnected', async () => {
      const spy = sinon.stub(mediaProperties, 'waitForMediaConnectionConnected');

      await mediaProperties.getCurrentConnectionType();

      assert.calledOnce(spy);
    });
    it('calls getStats() only after waitForMediaConnectionConnected resolves', async () => {
      const waitForMediaConnectionConnectedResult = new Defer();

      const waitForMediaConnectionConnectedStub = sinon
        .stub(mediaProperties, 'waitForMediaConnectionConnected')
        .returns(waitForMediaConnectionConnectedResult.promise);

      const result = mediaProperties.getCurrentConnectionType();

      await testUtils.flushPromises();

      assert.called(waitForMediaConnectionConnectedStub);
      assert.notCalled(mockMC.getStats);

      waitForMediaConnectionConnectedResult.resolve();
      await testUtils.flushPromises();

      assert.called(mockMC.getStats);
      await result;
    });
    it('rejects if waitForMediaConnectionConnected rejects', async () => {
      const waitForMediaConnectionConnectedResult = new Defer();

      const waitForMediaConnectionConnectedStub = sinon
        .stub(mediaProperties, 'waitForMediaConnectionConnected')
        .returns(waitForMediaConnectionConnectedResult.promise);

      const result = mediaProperties.getCurrentConnectionType();

      await testUtils.flushPromises();

      assert.called(waitForMediaConnectionConnectedStub);

      waitForMediaConnectionConnectedResult.reject(new Error('fake error'));
      await testUtils.flushPromises();

      assert.notCalled(mockMC.getStats);

      await assert.isRejected(result);
    });
    it('returns "unknown" if getStats() fails', async () => {
      mockMC.getStats.rejects(new Error());

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "unknown" if getStats() returns no candidate pairs', async () => {
      mockMC.getStats.resolves([{type: 'something', id: '1234'}]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "unknown" if getStats() returns no successful candidate pair', async () => {
      mockMC.getStats.resolves([{type: 'candidate-pair', id: '1234', state: 'inprogress'}]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'unknown');
    });

    it('returns "unknown" if getStats() returns a successful candidate pair but local candidate is missing', async () => {
      mockMC.getStats.resolves([
        {type: 'candidate-pair', id: '1234', state: 'succeeded', localCandidateId: 'wrong id'},
      ]);

      const connectionType = await mediaProperties.getCurrentConnectionType();
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

      const connectionType = await mediaProperties.getCurrentConnectionType();
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

      const connectionType = await mediaProperties.getCurrentConnectionType();
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

        const connectionType = await mediaProperties.getCurrentConnectionType();
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

      const connectionType = await mediaProperties.getCurrentConnectionType();
      assert.equal(connectionType, 'TURN-TLS');
    });
  });
});
