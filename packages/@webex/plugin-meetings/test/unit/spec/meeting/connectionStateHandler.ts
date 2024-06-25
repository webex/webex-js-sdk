import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {
  ConnectionStateHandler,
  ConnectionStateEvent,
} from '@webex/plugin-meetings/src/meeting/connectionStateHandler';
import {Event, ConnectionState} from '@webex/internal-media-core';

describe('ConnectionStateHandler', () => {
  let connectionStateHandler: ConnectionStateHandler;
  let mockMC;

  beforeEach(() => {
    mockMC = {
      on: sinon.stub(),
      off: sinon.stub(),
      getConnectionState: sinon.stub().returns(ConnectionState.New),
    };

    connectionStateHandler = new ConnectionStateHandler(mockMC);
  });

  describe('ConnectionStateChangedEvent', () => {
    it('should emit a CONNECTION_STATE_CHANGED event when the peer connection state changes', () => {
      const spy = sinon.spy(connectionStateHandler, 'emit');

      // check the right listener was registered
      assert.calledTwice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      const listener = mockMC.on.getCall(0).args[1];

      listener();

      assert.calledOnce(spy);
    });

    it('should emit a CONNECTION_STATE_CHANGED event when the ice connection state changes', () => {
      const spy = sinon.spy(connectionStateHandler, 'emit');

      // check the right listener was registered
      assert.calledTwice(mockMC.on);
      assert.equal(mockMC.on.getCall(0).args[0], Event.PEER_CONNECTION_STATE_CHANGED);
      assert.equal(mockMC.on.getCall(1).args[0], Event.ICE_CONNECTION_STATE_CHANGED);
      const listener = mockMC.on.getCall(1).args[1];

      listener();

      assert.calledOnce(spy);
    });
  });
});
