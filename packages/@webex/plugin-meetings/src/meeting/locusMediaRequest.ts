/* eslint-disable valid-jsdoc */
import {defer} from 'lodash';
import {Defer} from '@webex/common';
import {WebexPlugin} from '@webex/webex-core';
import {MEDIA, HTTP_VERBS, ROAP, IP_VERSION} from '../constants';
import LoggerProxy from '../common/logs/logger-proxy';

export type MediaRequestType = 'RoapMessage' | 'LocalMute';
export type RequestResult = any;

export type RoapRequest = {
  type: 'RoapMessage';
  selfUrl: string;
  mediaId: string;
  roapMessage: any;
  reachability: any;
  sequence?: any;
  joinCookie: any; // any, because this is opaque to the client, we pass whatever object we got from one backend component (Orpheus) to the other (Locus)
  ipVersion?: IP_VERSION;
};

export type LocalMuteRequest = {
  type: 'LocalMute';
  selfUrl: string;
  mediaId: string;
  sequence?: any;
  muteOptions: {
    audioMuted?: boolean;
    videoMuted?: boolean;
  };
};

export type Request = RoapRequest | LocalMuteRequest;

/** Class representing a single /media request being sent to Locus */
class InternalRequestInfo {
  public readonly request: Request;
  private pendingPromises: Defer[];
  private sendRequestFn: (request: Request) => Promise<RequestResult>;

  /** Constructor */
  constructor(
    request: Request,
    pendingPromise: Defer,
    sendRequestFn: (request: Request) => Promise<RequestResult>
  ) {
    this.request = request;
    this.pendingPromises = [pendingPromise];
    this.sendRequestFn = sendRequestFn;
  }

  /**
   * Returns the list of pending promises associated with this request
   */
  public getPendingPromises() {
    return this.pendingPromises;
  }

  /**
   * Adds promises to the list of pending promises associated with this request
   */
  public addPendingPromises(pendingPromises: Defer[]) {
    this.pendingPromises.push(...pendingPromises);
  }

  /**
   * Executes the request. Returned promise is resolved once the request
   * is completed (no matter if it succeeded or failed).
   */
  public execute(): Promise<void> {
    return this.sendRequestFn(this.request)
      .then((result) => {
        // resolve all the pending promises associated with this request
        this.pendingPromises.forEach((d) => d.resolve(result));
      })
      .catch((e) => {
        // reject all the pending promises associated with this request
        this.pendingPromises.forEach((d) => d.reject(e));
      });
  }
}

export type Config = {
  device: {
    url: string;
    deviceType: string;
    countryCode?: string;
    regionCode?: string;
  };
  correlationId: string;
  meetingId: string;
  preferTranscoding: boolean;
};

/**
 * Returns true if the request is triggering confluence creation in the server
 */
function isRequestAffectingConfluenceState(request: Request): boolean {
  return (
    request.type === 'RoapMessage' && request.roapMessage.messageType === ROAP.ROAP_TYPES.OFFER
  );
}

/**
 * This class manages all /media API requests to Locus. Every call to that
 * Locus API has to go through this class.
 */
export class LocusMediaRequest extends WebexPlugin {
  private config: Config;
  private latestAudioMuted?: boolean;
  private latestVideoMuted?: boolean;
  private isRequestInProgress: boolean;
  private queuedRequests: InternalRequestInfo[];
  private confluenceState: 'not created' | 'creation in progress' | 'created';
  /**
   * Constructor
   */
  constructor(config: Config, options: any) {
    super({}, options);
    this.isRequestInProgress = false;
    this.queuedRequests = [];
    this.config = config;
    this.confluenceState = 'not created';
  }

  /**
   * Add a request to the internal queue.
   */
  private addToQueue(info: InternalRequestInfo) {
    if (info.request.type === 'LocalMute' && this.queuedRequests.length > 0) {
      // We don't need additional local mute requests in the queue.
      // We only need at most 1 local mute or 1 roap request, because
      // roap requests also include mute state, so whatever request
      // is sent out, it will send the latest local mute state.
      // We only need to store the pendingPromises so that they get resolved
      // when the roap request is sent out.
      this.queuedRequests[0].addPendingPromises(info.getPendingPromises());

      return;
    }

    if (info.request.type === 'RoapMessage' && this.queuedRequests.length > 0) {
      // remove any LocalMute requests from the queue, because this Roap message
      // will also update the mute status in Locus, so they are redundant
      this.queuedRequests = this.queuedRequests.filter((r) => {
        if (r.request.type === 'LocalMute') {
          // we need to keep the pending promises from the local mute request
          // that we're removing from the queue
          info.addPendingPromises(r.getPendingPromises());

          return false;
        }

        return true;
      });
    }

    this.queuedRequests.push(info);
  }

  /**
   * Takes the next request from the queue and executes it. Once that
   * request is completed, the next one will be taken from the queue
   * and executed and this is repeated until the queue is empty.
   */
  private executeNextQueuedRequest(): void {
    if (this.isRequestInProgress) {
      return;
    }

    const nextRequest = this.queuedRequests.shift();

    if (nextRequest) {
      this.isRequestInProgress = true;
      nextRequest.execute().then(() => {
        this.isRequestInProgress = false;
        this.executeNextQueuedRequest();
      });
    }
  }

  /**
   * Returns latest requested audio and video mute values. If they have never been
   * requested, we assume audio/video to be muted.
   */
  private getLatestMuteState() {
    const audioMuted = this.latestAudioMuted !== undefined ? this.latestAudioMuted : true;
    const videoMuted = this.latestVideoMuted !== undefined ? this.latestVideoMuted : true;

    return {audioMuted, videoMuted};
  }

  /**
   * Prepares the uri and body for the media request to be sent to Locus
   */
  private sendHttpRequest(request: Request) {
    const uri = `${request.selfUrl}/${MEDIA}`;

    const {audioMuted, videoMuted} = this.getLatestMuteState();

    // first setup things common to all requests
    const body: any = {
      device: this.config.device,
      correlationId: this.config.correlationId,
      clientMediaPreferences: {
        preferTranscoding: this.config.preferTranscoding,
        ipver: request.type === 'RoapMessage' ? request.ipVersion : undefined,
      },
    };

    const localMedias: any = {
      audioMuted,
      videoMuted,
    };

    // now add things specific to request type
    switch (request.type) {
      case 'LocalMute':
        body.respOnlySdp = true;
        body.usingResource = null;
        break;

      case 'RoapMessage':
        localMedias.roapMessage = request.roapMessage;
        localMedias.reachability = request.reachability;
        body.clientMediaPreferences.joinCookie = request.joinCookie;

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.locus.media.request',
          options: {
            meetingId: this.config.meetingId,
          },
        });
        break;
    }

    if (request.sequence) {
      body.sequence = request.sequence;
    }

    body.localMedias = [
      {
        localSdp: JSON.stringify(localMedias), // this part must be JSON stringified, Locus requires this
        mediaId: request.mediaId,
      },
    ];

    LoggerProxy.logger.info(
      `Meeting:LocusMediaRequest#sendHttpRequest --> ${request.type} audioMuted=${audioMuted} videoMuted=${videoMuted}`
    );

    if (isRequestAffectingConfluenceState(request) && this.confluenceState === 'not created') {
      this.confluenceState = 'creation in progress';
    }

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.PUT,
      uri,
      body,
    })
      .then((result) => {
        if (isRequestAffectingConfluenceState(request)) {
          this.confluenceState = 'created';
        }

        if (request.type === 'RoapMessage') {
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.locus.media.response',
            options: {
              meetingId: this.config.meetingId,
            },
          });
        }

        return result;
      })
      .catch((e) => {
        if (
          isRequestAffectingConfluenceState(request) &&
          this.confluenceState === 'creation in progress'
        ) {
          this.confluenceState = 'not created';
        }

        if (request.type === 'RoapMessage') {
          // @ts-ignore
          this.webex.internal.newMetrics.submitClientEvent({
            name: 'client.locus.media.response',
            options: {
              meetingId: this.config.meetingId,
              rawError: e,
            },
          });
        }

        throw e;
      });
  }

  /**
   * Sends a media request to Locus
   */
  public send(request: Request): Promise<RequestResult> {
    if (request.type === 'LocalMute') {
      const {audioMuted, videoMuted} = request.muteOptions;

      if (audioMuted !== undefined) {
        this.latestAudioMuted = audioMuted;
      }
      if (videoMuted !== undefined) {
        this.latestVideoMuted = videoMuted;
      }

      if (this.confluenceState === 'not created') {
        // if there is no confluence, there is no point sending out local mute request
        // as it will fail so we just store the latest audio/video muted values
        // and resolve immediately, so that higher layer (MuteState class) doesn't get blocked
        // and can call us again if user mutes/unmutes again before confluence is created
        LoggerProxy.logger.info(
          'Meeting:LocusMediaRequest#send --> called with LocalMute request before confluence creation'
        );

        return Promise.resolve({});
      }
    }

    const pendingPromise = new Defer();

    const newRequest = new InternalRequestInfo(
      request,
      pendingPromise,
      this.sendHttpRequest.bind(this)
    );

    this.addToQueue(newRequest);

    defer(() => this.executeNextQueuedRequest());

    return pendingPromise.promise;
  }

  /** Returns true if a confluence on the server is already created */
  public isConfluenceCreated() {
    return this.confluenceState === 'created';
  }
}
