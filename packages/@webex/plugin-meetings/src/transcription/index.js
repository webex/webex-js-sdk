import {v4 as uuidv4} from 'uuid';

/**
 * @description Meeting Webex assistance transcription feature.
 * @exports
 * @class Transcription
 */
export default class Transcription {
  /**
   * @param {string} webSocketUrl
   * @param {sessionID} sessionId
   * @param {object} members
   * @constructor
   * @memberof Transcription
   */
  constructor(webSocketUrl, sessionId, members) {
    this.webSocketUrl = webSocketUrl;
    this.sessionID = sessionId;
    this.members = members;
    this.memberCSIs = {};

    const params = '?outboundWireFormat=text&bufferStates=true&aliasHttpStatus=true';

    this.webSocket = new WebSocket(`${this.webSocketUrl}${params}`);
  }

  /**
   * open the Low Latency Mercury connection
   * An event parameter will be send to the callback.
   *
   * @param {string} token
   * @param {string} sessionID
   * @returns {void}
   */
  connect(token) {
    this.webSocket.onopen = () => {
      this.webSocket.send(JSON.stringify({
        id: uuidv4(),
        type: 'authorization',
        data: {token: `Bearer ${token}`},
        trackingId: `webex-js-sdk_${this.sessionID}${Date.now.toString()}`
      }));
    };
  }

  /**
   * Sets callback to invoke when the web socket connection is closed.
   *
   * @param {function} callback
   * @returns {void}
   */
  onCloseSocket(callback) {
    if (callback) {
      this.webSocket.onclose = (event) => {
        callback(event);
      };
    }
  }

  /**
   * Sets callback to invoke when a web socket connection error occurs.
   * An event parameter will be send to the callback.
   *
   * @param {function} callback
   * @returns {void}
   */
  onErrorSocket(callback) {
    if (callback) {
      this.webSocket.onerror = (event) => {
        callback(event);
      };
    }
  }

  /**
   * Get current speaker from the given csis payload and update the global csis map
   *
   * @private
   * @param {object} csis
   * @returns {object}
   */
  getSpeaker(csis) {
    for (const csi of csis) {
      const member = this.memberCSIs[csi];

      if (member) {
        return member;
      }
    }

    return Object.values(this.members.membersCollection.members)
      .find((member) => {
        const memberCSIs = member.participant.status.csis;
        let selfIsSpeaking = false;

        for (const csi of csis) {
          if (memberCSIs.includes(csi)) {
            this.memberCSIs[csi] = member;
            selfIsSpeaking = true;
            break;
          }
        }

        return selfIsSpeaking;
      });
  }

  /**
   * Sends transcription data to given callback as it arrives.
   *
   * @param {function} callback
   * @returns {void}
   */
  subscribe(callback) {
    let data, csis, speaker, transcription;

    this.webSocket.onmessage = (event) => {
      data = JSON.parse(event.data);
      csis = data.data?.voiceaPayload?.csis || [];
      speaker = this.getSpeaker(csis);
      transcription = data.data?.voiceaPayload?.data || '';

      this.webSocket.send(JSON.stringify({messageID: data.id, type: 'ack'}));

      if (transcription) {
        callback(
          {
            id: data.data?.voiceaPayload?.transcript_id,
            personID: speaker?.id,
            transcription,
            timestamp: data.timestamp,
            type: data?.data?.voiceaPayload?.type
          }
        );
      }
    };
  }

  /**
   * Close the LLM web socket connection
   * @returns {void}
   */
  closeSocket() {
    this.webSocket.close();
  }
}

