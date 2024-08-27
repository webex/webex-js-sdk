import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {
  ConnectionStateHandler,
  ConnectionStateEvent,
} from '@webex/plugin-meetings/src/meeting/connectionStateHandler';
import {ConnectionState, MediaConnectionEventNames} from '@webex/internal-media-core';

describe('ConnectionStateHandler', () => {
  let connectionStateHandler: ConnectionStateHandler;
  let mockMC;

  beforeEach(() => {
    mockMC = {
      on: sinon.stub(),
      off: sinon.stub(),
      getConnectionState: sinon.stub().returns(ConnectionState.Connecting),
    };

    connectionStateHandler = new ConnectionStateHandler(mockMC);
  });

  describe('ConnectionStateChangedEvent', () => {
    it('should emit a stateChanged event when the peer connection state changes', () => {
      const spy = sinon.spy(connectionStateHandler, 'emit');

      // check the right listener was registered
      assert.calledTwice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      const listener = mockMC.on.getCall(0).args[1];

      listener();

      assert.calledOnce(spy);
      assert.calledOnceWithExactly(
        connectionStateHandler.emit,
        {
          file: 'connectionStateHandler',
          function: 'handleConnectionStateChange',
        },
        ConnectionStateEvent.stateChanged,
        {
          state: ConnectionState.Connecting,
        }
      );
    });

    it('should emit a stateChanged event when the ice connection state changes', () => {
      const spy = sinon.spy(connectionStateHandler, 'emit');

      // check the right listener was registered
      assert.calledTwice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      const listener = mockMC.on.getCall(1).args[1];

      listener();

      assert.calledOnce(spy);
      assert.calledOnceWithExactly(
        connectionStateHandler.emit,
        {
          file: 'connectionStateHandler',
          function: 'handleConnectionStateChange',
        },
        ConnectionStateEvent.stateChanged,
        {
          state: ConnectionState.Connecting,
        }
      );
    });

    it('should emit a stateChanged event only once when overall connection state does not change', () => {
      const spy = sinon.spy(connectionStateHandler, 'emit');

      // check the right listener was registered
      assert.calledTwice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);
      const peerConnectionListener = mockMC.on.getCall(0).args[1];
      const iceConnectionListener = mockMC.on.getCall(1).args[1];

      peerConnectionListener();

      iceConnectionListener();

      assert.calledOnce(spy);
      assert.calledOnceWithExactly(
        connectionStateHandler.emit,
        {
          file: 'connectionStateHandler',
          function: 'handleConnectionStateChange',
        },
        ConnectionStateEvent.stateChanged,
        {
          state: ConnectionState.Connecting,
        }
      );
    });
  });
});
