import Transcription from '@webex/plugin-meetings/src/transcription';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

describe('transcription index', () => {
  let webSocketUrl, members, sessionId, token, transcription;

  beforeEach(() => {
    webSocketUrl = 'ws://webSocketUrl';
    members = {
      membersCollection: {
        members: {
          member1: {
            id: 'member',
            participant: {
              status: {
                csis: [1, 2, 3]
              }
            }
          }
        }
      }
    };
    sessionId = 'sessionId';
    token = 'token';
    transcription = new Transcription(webSocketUrl, sessionId, members);
  });


  it('open websocket connection', async () => {
    await transcription.connect(token);
    transcription.webSocket.onopen = sinon.stub();

    assert.equal(transcription.webSocket.OPEN, 1);
  });

  it('get current speaker', () => {
    const isSpeaking = transcription.getSpeaker([1, 4, 5]);

    assert.equal(isSpeaking, members.membersCollection.members.member1);
  });

  it('get current speaker', () => {
    const isSpeaking = transcription.getSpeaker([1, 4, 5]);

    assert.isOk(transcription.memberCSIs, {member: 1});
    assert.equal(isSpeaking, members.membersCollection.members.member1);
  });

  it('disconnect() shuold close the socket', async () => {
    await transcription.connect();
    transcription.closeSocket();

    assert.equal(transcription.webSocket.CLOSED, 3);
  });
});
