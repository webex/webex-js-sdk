import 'jsdom-global/register';
import {EventEmitter} from 'events';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {
  ConnectionState,
  MediaConnectionEventNames,
  MediaType,
} from '@webex/internal-media-core';
import MediaRequestQueue from '@webex/plugin-meetings/src/multistream/mediaRequestQueue';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';

describe('MediaRequestQueue', () => {
  let fakeMediaConnection;
  let queue: MediaRequestQueue;
  let infoSpy;
  let errorSpy;

  const audioRequests = [{id: 'audio-request'}] as any;
  const videoRequests = [{id: 'video-request'}] as any;

  const setConnectionState = (state: ConnectionState, eventName: string) => {
    fakeMediaConnection.getConnectionState.returns(state);
    fakeMediaConnection.emit(eventName);
  };

  const enqueueAudioAndVideoRequests = () => {
    queue.requestMedia(MediaType.AudioMain, audioRequests);
    queue.requestMedia(MediaType.VideoMain, videoRequests);
  };

  beforeEach(() => {
    LoggerConfig.set({enable: false});
    LoggerProxy.set();
    infoSpy = sinon.spy(LoggerProxy.logger, 'info');
    errorSpy = sinon.spy(LoggerProxy.logger, 'error');

    fakeMediaConnection = new EventEmitter();
    fakeMediaConnection.getConnectionState = sinon.stub().returns(ConnectionState.Connected);
    fakeMediaConnection.requestMedia = sinon.stub();

    queue = new MediaRequestQueue(fakeMediaConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('sends the request immediately when the connection is connected', () => {
    queue.requestMedia(MediaType.AudioMain, audioRequests);

    assert.calledOnceWithExactly(
      fakeMediaConnection.requestMedia,
      MediaType.AudioMain,
      audioRequests
    );
    assert.notCalled(infoSpy);
  });

  [ConnectionState.New, ConnectionState.Connecting, ConnectionState.Disconnected, ConnectionState.Failed, ConnectionState.Closed].forEach(
    (state) => {
      it(`queues the request when the connection state is ${state}`, () => {
        fakeMediaConnection.getConnectionState.returns(state);

        queue.requestMedia(MediaType.AudioMain, audioRequests);

        assert.notCalled(fakeMediaConnection.requestMedia);
        assert.calledOnceWithExactly(
          infoSpy,
          `MediaRequestQueue#requestMedia --> connection not-ready, enqueuing requestMedia(${MediaType.AudioMain}) task`
        );
      });
    }
  );

  [
    MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
    MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
  ].forEach((eventName) => {
    it(`flushes the queued requests in order when the connection becomes connected (${eventName})`, () => {
      fakeMediaConnection.getConnectionState.returns(ConnectionState.Closed);
      enqueueAudioAndVideoRequests();
      infoSpy.resetHistory();

      setConnectionState(ConnectionState.Connected, eventName);

      assert.calledTwice(fakeMediaConnection.requestMedia);
      assert.deepEqual(fakeMediaConnection.requestMedia.args, [
        [MediaType.AudioMain, audioRequests],
        [MediaType.VideoMain, videoRequests],
      ]);
      assert.deepEqual(
        infoSpy.args.map(([message]) => message),
        [
          'MediaRequestQueue#flush --> flushing queue, tasks: 2',
          `MediaRequestQueue#flush --> running requestMedia(${MediaType.AudioMain}) task`,
          `MediaRequestQueue#flush --> running requestMedia(${MediaType.VideoMain}) task`,
        ]
      );
    });
  });

  it('does not flush the queued requests on state changes other than connected', () => {
    fakeMediaConnection.getConnectionState.returns(ConnectionState.Closed);
    enqueueAudioAndVideoRequests();

    setConnectionState(ConnectionState.New, MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
    setConnectionState(
      ConnectionState.Connecting,
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED
    );

    assert.notCalled(fakeMediaConnection.requestMedia);
  });

  it('sends the queued requests before a new request if the connected event was not handled yet', () => {
    fakeMediaConnection.getConnectionState.returns(ConnectionState.Closed);
    queue.requestMedia(MediaType.AudioMain, audioRequests);

    fakeMediaConnection.getConnectionState.returns(ConnectionState.Connected);
    queue.requestMedia(MediaType.VideoMain, videoRequests);

    assert.deepEqual(fakeMediaConnection.requestMedia.args, [
      [MediaType.AudioMain, audioRequests],
      [MediaType.VideoMain, videoRequests],
    ]);
  });

  it('sends each queued request only once', () => {
    fakeMediaConnection.getConnectionState.returns(ConnectionState.Closed);
    queue.requestMedia(MediaType.AudioMain, audioRequests);

    setConnectionState(ConnectionState.Connected, MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);
    setConnectionState(ConnectionState.Connected, MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED);

    assert.calledOnceWithExactly(
      fakeMediaConnection.requestMedia,
      MediaType.AudioMain,
      audioRequests
    );
  });

  it('continues flushing when one of the queued requests throws', () => {
    const error = new Error('fake error');

    fakeMediaConnection.getConnectionState.returns(ConnectionState.Closed);
    enqueueAudioAndVideoRequests();
    fakeMediaConnection.requestMedia.onFirstCall().throws(error);

    setConnectionState(ConnectionState.Connected, MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);

    assert.calledTwice(fakeMediaConnection.requestMedia);
    assert.calledWithExactly(
      fakeMediaConnection.requestMedia.secondCall,
      MediaType.VideoMain,
      videoRequests
    );
    assert.calledOnceWithExactly(
      errorSpy,
      `MediaRequestQueue#flush --> requestMedia(${MediaType.AudioMain}) task failed`,
      error
    );
  });

  it('stop() discards the queued requests and removes the listeners', () => {
    fakeMediaConnection.getConnectionState.returns(ConnectionState.Closed);
    enqueueAudioAndVideoRequests();

    queue.stop();
    setConnectionState(ConnectionState.Connected, MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED);

    assert.notCalled(fakeMediaConnection.requestMedia);
    assert.equal(
      fakeMediaConnection.listenerCount(MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED),
      0
    );
    assert.equal(
      fakeMediaConnection.listenerCount(MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED),
      0
    );
  });
});
