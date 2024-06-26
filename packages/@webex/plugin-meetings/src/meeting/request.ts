import uuid from 'uuid';
import {debounce} from 'lodash';
import {StatelessWebexPlugin} from '@webex/webex-core';
import {deviceType} from '@webex/common';
import {CallDiagnosticUtils} from '@webex/internal-plugin-metrics';

import LoggerProxy from '../common/logs/logger-proxy';
import {
  ALERT,
  ALTERNATE_REDIRECT_TRUE,
  BREAKOUTS,
  CALL,
  CONTROLS,
  DECLINE,
  END,
  FLOOR_ACTION,
  HTTP_VERBS,
  LEAVE,
  LOCI,
  PARTICIPANT,
  PROVISIONAL_TYPE_DIAL_IN,
  PROVISIONAL_TYPE_DIAL_OUT,
  REACHABILITY,
  SEND_DTMF_ENDPOINT,
  _SLIDES_,
  ANNOTATION,
  IP_VERSION,
} from '../constants';
import {SendReactionOptions, ToggleReactionsOptions} from './request.type';
import MeetingUtil from './util';
import {AnnotationInfo} from '../annotation/annotation.types';

/**
 * @class MeetingRequest
 */
export default class MeetingRequest extends StatelessWebexPlugin {
  changeVideoLayoutDebounced: any;
  meetingRef: WeakRef<any> | undefined;
  locusDeltaRequest: (options: object) => Promise<any>;
  buildLocusDeltaRequestOptions: (options: object) => Record<string, any>;

  /**
   * Constructor
   * @param {Object} attrs
   * @param {Object} options
   */
  constructor(attrs: any, options: any) {
    const {meeting, ...otherAttrs} = attrs;

    super(otherAttrs, options);

    this.locusDeltaRequest = MeetingUtil.generateLocusDeltaRequest(meeting);
    this.buildLocusDeltaRequestOptions = MeetingUtil.generateBuildLocusDeltaRequestOptions(meeting);

    this.changeVideoLayoutDebounced = debounce(this.changeVideoLayout, 2000, {
      leading: true,
      trailing: true,
    });
  }

  /**
   * Returns joinCookie from boundedStorage if present.
   * @returns {Object} joinCookie
   */
  private getJoinCookie = async () => {
    // @ts-ignore
    const joinCookieRaw = await this.webex.boundedStorage
      .get(REACHABILITY.namespace, REACHABILITY.localStorageJoinCookie)
      .catch(() => {});

    if (joinCookieRaw) {
      try {
        const joinCookie = JSON.parse(joinCookieRaw);
        if (joinCookie) {
          return joinCookie;
        }
      } catch (e) {
        LoggerProxy.logger.error(
          `MeetingRequest#constructor --> Error in parsing join cookie data: ${e}`
        );
      }
    }

    return null;
  };

  /**
   * Make a network request to join a meeting
   * @param {Object} options
   * @param {String} options.sipUri
   * @param {String} options.deviceUrl
   * @param {String} options.locusUrl
   * @param {String} options.resourceId,
   * @param {String} options.correlationId
   * @param {boolean} options.ensureConversation
   * @param {boolean} options.moderator
   * @param {boolean} options.pin
   * @param {boolean} options.moveToResource
   * @param {Object} options.roapMessage
   * @param {boolean} options.breakoutsSupported
   * @param {String} options.locale,
   * @param {Array} options.deviceCapabilities
   * @param {boolean} options.liveAnnotationSupported
   * @param {String} options.alias
   * @returns {Promise}
   */
  async joinMeeting(options: {
    sipUri: string;
    deviceUrl: string;
    locusUrl: string;
    locusClusterUrl: string;
    resourceId: string;
    correlationId: string;
    ensureConversation: boolean;
    moderator: boolean;
    pin: boolean;
    moveToResource: boolean;
    roapMessage: any;
    asResourceOccupant: any;
    inviteeAddress: any;
    meetingNumber: any;
    permissionToken: any;
    preferTranscoding: any;
    reachability: any;
    breakoutsSupported: boolean;
    locale?: string;
    deviceCapabilities?: Array<string>;
    liveAnnotationSupported: boolean;
    ipVersion?: IP_VERSION;
    alias?: string;
  }) {
    const {
      asResourceOccupant,
      inviteeAddress,
      meetingNumber,
      permissionToken,
      deviceUrl,
      locusUrl,
      locusClusterUrl,
      resourceId,
      correlationId,
      ensureConversation,
      moderator,
      pin,
      moveToResource,
      roapMessage,
      reachability,
      preferTranscoding,
      breakoutsSupported,
      locale,
      deviceCapabilities = [],
      liveAnnotationSupported,
      ipVersion,
      alias,
    } = options;

    LoggerProxy.logger.info('Meeting:request#joinMeeting --> Joining a meeting', correlationId);

    let url = '';

    const joinCookie = await this.getJoinCookie();

    const body: any = {
      asResourceOccupant,
      device: {
        url: deviceUrl,
        // @ts-ignore - config comes from registerPlugin
        deviceType: this.config.meetings.deviceType,
      },
      usingResource: resourceId || null,
      moveMediaToResource: (resourceId && moveToResource) || false,
      correlationId,
      respOnlySdp: true,
      allowMultiDevice: true,
      ensureConversation: ensureConversation || false,
      supportsNativeLobby: 1,
      clientMediaPreferences: {
        preferTranscoding: preferTranscoding ?? true,
        joinCookie,
        ipver: ipVersion,
      },
    };

    if (alias) {
      body.alias = alias;
    }

    if (breakoutsSupported) {
      deviceCapabilities.push(BREAKOUTS.BREAKOUTS_SUPPORTED);
    }
    if (liveAnnotationSupported) {
      deviceCapabilities.push(ANNOTATION.ANNOTATION_ON_SHARE_SUPPORTED);
    }

    // append installationId to device config if it exists
    // @ts-ignore
    if (this.webex.internal.device.config.installationId) {
      // @ts-ignore
      body.device.installationId = this.webex.internal.device.config.installationId;
    }

    if (locale) {
      body.locale = locale;
    }

    // add deviceCapabilities prop
    if (deviceCapabilities.length) {
      body.deviceCapabilities = deviceCapabilities;
    }
    // @ts-ignore
    if (this.webex.meetings.geoHintInfo) {
      // @ts-ignore
      body.device.countryCode = this.webex.meetings.geoHintInfo.countryCode;
      // @ts-ignore
      body.device.regionCode = this.webex.meetings.geoHintInfo.regionCode;
      body.device.localIp =
        // @ts-ignore
        CallDiagnosticUtils.anonymizeIPAddress(this.webex.meetings.geoHintInfo.clientAddress) ||
        undefined;
    }

    if (moderator !== undefined) {
      body.moderator = moderator;
    }

    if (permissionToken) {
      body.permissionToken = permissionToken;
    }

    if (pin !== undefined) {
      body.pin = pin;
    }

    if (locusUrl) {
      url = `${locusUrl}/${PARTICIPANT}`;
    } else if (inviteeAddress || meetingNumber) {
      try {
        let clusterUrl;

        if (locusClusterUrl) {
          clusterUrl = `https://${locusClusterUrl}/locus/api/v1`;
        } else {
          // @ts-ignore
          await this.webex.internal.services.waitForCatalog('postauth');
          // @ts-ignore
          clusterUrl = this.webex.internal.services.get('locus');
        }

        url = `${clusterUrl}/${LOCI}/${CALL}`;
        body.invitee = {
          address: inviteeAddress || `wbxmn:${meetingNumber}`,
        };
      } catch (e) {
        LoggerProxy.logger.error(
          `Meeting:request#joinMeeting Error Joining ${inviteeAddress || meetingNumber} --> ${e}`
        );
        throw e;
      }
    }

    // TODO: -- this will be resolved in SDK request
    url = url.concat(`?${ALTERNATE_REDIRECT_TRUE}`);

    if (resourceId === inviteeAddress) {
      body.callPreferences = {
        requestedMedia: [_SLIDES_],
      };
    }

    if (roapMessage || reachability) {
      body.localMedias = [
        {
          localSdp: JSON.stringify({
            roapMessage,
            reachability,
          }),
        },
      ];
    }

    /// @ts-ignore
    return this.request({
      method: HTTP_VERBS.POST,
      uri: url,
      body,
    });
  }

  /**
   * Send a request to refresh the captcha
   * @param {Object} options
   * @param {String} options.captchaRefreshUrl
   * @param {String} options.captchaId
   * @returns {Promise}
   * @private
   */
  private refreshCaptcha({
    captchaRefreshUrl,
    captchaId,
  }: {
    captchaRefreshUrl: string;
    captchaId: string;
  }) {
    const body = {
      captchaId,
    };

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.POST,
      uri: captchaRefreshUrl,
      body,
    }).catch((err: unknown) => {
      LoggerProxy.logger.error(`Meeting:request#refreshCaptcha --> Error: ${err}`);

      throw err;
    });
  }

  /**
   * Make a network request to add a dial in device
   * @param {Object} options
   * @param {String} options.correlationId
   * @param {String} options.locusUrl url for the meeting
   * @param {String} options.dialInUrl identifier for the to-be provisioned device
   * @param {String} options.clientUrl identifier for the web device
   * @returns {Promise}
   * @private
   */
  private dialIn({
    locusUrl,
    dialInUrl,
    clientUrl,
    correlationId,
  }: {
    correlationId: string | undefined;
    locusUrl: string;
    dialInUrl: string;
    clientUrl: string;
  }) {
    LoggerProxy.logger.info(
      'Meeting:request#dialIn --> Provisioning a dial in device',
      correlationId
    );
    const uri = `${locusUrl}/${PARTICIPANT}`;

    const body = {
      device: {
        deviceType: deviceType.PROVISIONAL,
        provisionalType: PROVISIONAL_TYPE_DIAL_IN,
        url: dialInUrl,
        clientUrl,
      },
      correlationId,
    };

    // @ts-ignore
    return this.locusDeltaRequest({
      method: HTTP_VERBS.POST,
      uri,
      body,
    }).catch((err) => {
      LoggerProxy.logger.error(
        `Meeting:request#dialIn --> Error provisioning a dial in device, error ${err}`
      );

      throw err;
    });
  }

  /**
   * Make a network request to add a dial out device
   * @param {Object} options
   * @param {String} options.correlationId
   * @param {String} options.locusUrl url for the meeting
   * @param {String} options.dialOutUrl identifier for the to-be provisioned device
   * @param {String} options.phoneNumber phone number to dial out to
   * @param {String} options.clientUrl identifier for the web device
   * @returns {Promise}
   * @private
   */
  private dialOut({
    locusUrl,
    dialOutUrl,
    phoneNumber,
    clientUrl,
    correlationId,
  }: {
    correlationId: string | undefined;
    locusUrl: string;
    dialOutUrl: string;
    phoneNumber: string;
    clientUrl: string;
  }) {
    LoggerProxy.logger.info(
      'Meeting:request#dialOut --> Provisioning a dial out device',
      correlationId
    );
    const uri = `${locusUrl}/${PARTICIPANT}`;

    const body = {
      device: {
        deviceType: deviceType.PROVISIONAL,
        provisionalType: PROVISIONAL_TYPE_DIAL_OUT,
        url: dialOutUrl,
        dialoutAddress: phoneNumber,
        clientUrl,
      },
      correlationId,
    };

    return this.locusDeltaRequest({
      method: HTTP_VERBS.POST,
      uri,
      body,
    }).catch((err) => {
      LoggerProxy.logger.error(
        `Meeting:request#dialOut --> Error provisioning a dial out device, error ${err}`
      );

      throw err;
    });
  }

  /**
   * Sends a requests to get the latest locus DTO, it might be a full Locus or a delta, depending on the url provided
   * @param {Object} options
   * @param {String} options.locusUrl sync url to get ht elatest locus delta
   * @returns {Promise}
   */
  getLocusDTO(options: {url: string}) {
    const {url} = options;

    if (url) {
      // @ts-ignore
      return this.request({
        method: HTTP_VERBS.GET,
        uri: url,
      }).catch((err: unknown) => {
        LoggerProxy.logger.error(
          `Meeting:request#getLocusDTO --> Error getting latest locus, error ${err}`
        );

        throw err;
      });
    }

    return Promise.reject();
  }

  /**
   * Make a network request to make a provisioned phone leave the meeting
   * @param {Object} options
   * @param {String} options.locusUrl
   * @param {String} options.phoneUrl
   * @param {String} options.correlationId
   * @param {String} options.selfId
   * @returns {Promise}
   * @private
   */
  private disconnectPhoneAudio({
    locusUrl,
    phoneUrl,
    correlationId,
    selfId,
  }: {
    locusUrl: string;
    phoneUrl: string;
    correlationId: string;
    selfId: string;
  }) {
    LoggerProxy.logger.info(
      `Meeting:request#disconnectPhoneAudio --> request phone ${phoneUrl} to leave`,
      correlationId
    );
    const uri = `${locusUrl}/${PARTICIPANT}/${selfId}/${LEAVE}`;

    const body = {
      device: {
        deviceType: deviceType.PROVISIONAL,
        url: phoneUrl,
      },
      correlationId,
    };

    // @ts-ignore
    return this.locusDeltaRequest({
      method: HTTP_VERBS.PUT,
      uri,
      body,
    }).catch((err) => {
      LoggerProxy.logger.error(
        `Meeting:request#disconnectPhoneAudio --> Error when requesting phone ${phoneUrl} to leave, error ${err}`
      );

      throw err;
    });
  }

  /**
   * Prepares request options to to leave a meeting
   * @param {Object} options
   * @param {Url} options.locusUrl
   * @param {String} options.selfId
   * @param {Url} options.deviceUrl
   * @param {String} options.resourceId,
   * @param {String} options.correlationId
   * @returns {Object} request options
   */
  prepareLeaveMeetingRequestOptions({
    locusUrl,
    selfId,
    deviceUrl: url,
    resourceId,
    correlationId,
  }: {
    locusUrl: string;
    selfId: string;
    deviceUrl: string;
    resourceId: string;
    correlationId: string;
  }) {
    const uri = `${locusUrl}/${PARTICIPANT}/${selfId}/${LEAVE}`;
    const body = {
      device: {
        // @ts-ignore
        deviceType: this.config.meetings.deviceType,
        url,
      },
      usingResource: resourceId || null,
      correlationId,
    };

    return {
      method: HTTP_VERBS.PUT,
      uri,
      body,
    };
  }

  /**
   * Make a network request to leave a meeting
   * @param {Object} options
   * @returns {Promise}
   */
  leaveMeeting({
    locusUrl,
    selfId,
    deviceUrl: url,
    resourceId,
    correlationId,
  }: {
    locusUrl: string;
    selfId: string;
    deviceUrl: string;
    resourceId: string;
    correlationId: string;
  }) {
    LoggerProxy.logger.info('Meeting:request#leaveMeeting --> Leaving a meeting', correlationId);

    const uri = `${locusUrl}/${PARTICIPANT}/${selfId}/${LEAVE}`;
    const body = {
      device: {
        // @ts-ignore
        deviceType: this.config.meetings.deviceType,
        url,
      },
      usingResource: resourceId || null,
      correlationId,
    };

    return this.locusDeltaRequest({
      method: HTTP_VERBS.PUT,
      uri,
      body,
    });
  }

  /**
   * Builds request options to leave a meeting
   * @param {Object} options
   * @returns {Object} request options
   */
  buildLeaveMeetingRequestOptions(options: any) {
    return this.buildLocusDeltaRequestOptions(this.prepareLeaveMeetingRequestOptions(options));
  }

  /**
   * Make a network request to acknowledge a meeting
   * @param {Object} options
   * @param {string} options.locusUrl
   * @param {string} options.deviceUrl
   * @param {string | undefined} options.correlationId
   * @returns {Promise}
   */
  acknowledgeMeeting(options: {
    locusUrl: string;
    deviceUrl: string;
    correlationId: string | undefined;
  }) {
    const uri = `${options.locusUrl}/${PARTICIPANT}/${ALERT}`;
    const body = {
      device: {
        // @ts-ignore
        deviceType: this.config.meetings.deviceType,
        url: options.deviceUrl,
      },
      correlationId: options.correlationId,
    };

    return this.locusDeltaRequest({
      method: HTTP_VERBS.PUT,
      uri,
      body,
    });
  }

  /**
   * Makes a network request to lock the meeting
   * @param {Object} options
   * @param {Boolean} options.lock Whether it is locked or not
   * @returns {Promise}
   */
  lockMeeting(options: Record<string, any>) {
    const uri = `${options.locusUrl}/${CONTROLS}`;
    const body = {
      lock: {
        locked: options.lock,
      },
    };

    return this.locusDeltaRequest({
      method: HTTP_VERBS.PATCH,
      uri,
      body,
    });
  }

  /**
   * Make a network request to decline a meeting
   * @param {Object} options
   * @param {String} options.locusUrl
   * @param {String} options.deviceUrl
   * @param {String} options.reason
   * @returns {Promise}
   */
  declineMeeting(options: {locusUrl: string; deviceUrl: string; reason: string}) {
    const uri = `${options.locusUrl}/${PARTICIPANT}/${DECLINE}`;
    const body = {
      device: {
        // @ts-ignore
        deviceType: this.config.meetings.deviceType,
        url: options.deviceUrl,
      },
      ...(options.reason && {reason: options.reason}),
    };

    return this.locusDeltaRequest({
      method: HTTP_VERBS.PUT,
      uri,
      body,
    });
  }

  /**
   * change the content floor grant
   * @param {Object} options options for floor grant
   * @param {String} options.disposition floor action (granted/released)
   * @param {String} options.personUrl personUrl who is requesting floor
   * @param {String} options.deviceUrl Url of a device
   * @param {String} options.resourceId Populated if you are paired to a device
   * @param {String} options.uri floor grant uri
   * @param {String} options.shareInstanceId id for current share
   * @returns {Promise}
   */
  changeMeetingFloor(
    options:
      | {
          disposition: string;
          personUrl: string;
          deviceUrl: string;
          resourceId: string;
          uri: string;
          annotationInfo: AnnotationInfo;
          shareInstanceId: string;
        }
      | any
  ) {
    let floorReq: any = {disposition: options.disposition};

    /* istanbul ignore else */
    if (options.disposition === FLOOR_ACTION.GRANTED) {
      floorReq = {
        beneficiary: {
          url: options.personUrl,
          devices: [
            {
              // @ts-ignore
              deviceType: this.config.meetings.deviceType,
              url: options.deviceUrl,
            },
          ],
        },
        disposition: options.disposition,
        requester: {
          url: options.personUrl,
        },
      };
    }

    const body: any = {
      floor: floorReq,
      resourceUrl: options.resourceUrl,
    };

    if (options?.shareInstanceId) {
      body.floor.shareInstanceId = options.shareInstanceId;
    }

    if (options?.resourceToken) {
      body.resourceToken = options?.resourceToken;
    }
    if (options?.annotationInfo) {
      body.annotation = options?.annotationInfo;
    }

    // @ts-ignore
    return this.request({
      uri: options.uri,
      method: HTTP_VERBS.PUT,
      body,
    });
  }

  /**
   * Sends a request to the DTMF endpoint to send tones
   * @param {Object} options
   * @param {String} options.locusUrl
   * @param {String} options.deviceUrl
   * @param {String} options.tones a string of one or more DTMF tones to send
   * @returns {Promise}
   */
  sendDTMF({locusUrl, deviceUrl, tones}: {locusUrl: string; deviceUrl: string; tones: string}) {
    // @ts-ignore
    return this.locusDeltaRequest({
      method: HTTP_VERBS.POST,
      uri: `${locusUrl}/${SEND_DTMF_ENDPOINT}`,
      body: {
        deviceUrl,
        dtmf: {
          correlationId: uuid.v4(),
          tones,
        },
      },
    });
  }

  /**
   * Sends a request to the controls endpoint to set the video layout
   * @param {Object} options
   * @param {String} options.locusUrl
   * @param {String} options.deviceUrl
   * @param {String} options.layoutType a layout type that should be available in meeting constants {@link #layout_types}
   * @param {Object} options.main preferred dimensions for the remote main video stream
   * @param {Number} options.main.width preferred width of main video stream
   * @param {Number} options.main.height preferred height of main video stream
   * @param {Object} options.content preferred dimensions for the remote content share stream
   * @param {Number} options.content.width preferred width of content share stream
   * @param {Number} options.content.height preferred height of content share stream
   * @returns {Promise}
   */
  changeVideoLayout({
    locusUrl,
    deviceUrl,
    layoutType,
    main,
    content,
  }: {
    locusUrl: string;
    deviceUrl: string;
    layoutType: string;
    main: {
      width: number;
      height: number;
    };
    content: {
      width: number;
      height: number;
    };
  }) {
    // send main/content renderInfo only if both width and height are specified
    if (main && (!main.width || !main.height)) {
      return Promise.reject(
        new Error(
          `Both width and height must be specified. One of them is missing for main: ${JSON.stringify(
            main
          )}`
        )
      );
    }

    if (content && (!content.width || !content.height)) {
      return Promise.reject(
        new Error(
          `Both width and height must be specified. One of them is missing for content: ${JSON.stringify(
            content
          )}`
        )
      );
    }

    const renderInfoMain = main ? {width: main.width, height: main.height} : undefined;
    const renderInfoContent = content ? {width: content.width, height: content.height} : undefined;

    const layoutParams =
      renderInfoMain || renderInfoContent
        ? {
            renderInfo: {
              main: renderInfoMain,
              content: renderInfoContent,
            },
          }
        : undefined;

    // @ts-ignore
    return this.locusDeltaRequest({
      method: HTTP_VERBS.PUT,
      uri: `${locusUrl}/${CONTROLS}`,
      body: {
        layout: {
          deviceUrl,
          type: layoutType,
          layoutParams,
        },
      },
    });
  }

  /**
   * Make a network request to end meeting for all
   * @param {Object} options
   * @param {Url} options.locusUrl
   * @returns {Promise}
   */
  endMeetingForAll({locusUrl}: {locusUrl: string}) {
    const uri = `${locusUrl}/${END}`;

    // @ts-ignore
    return this.locusDeltaRequest({
      method: HTTP_VERBS.POST,
      uri,
    });
  }

  /**
   * Send a locus keepAlive (used in lobby)
   * @param {Object} options
   * @param {Url} options.keepAliveUrl
   * @returns {Promise}
   */
  keepAlive({keepAliveUrl}: {keepAliveUrl: string}) {
    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.GET,
      uri: keepAliveUrl,
    });
  }

  /**
   * Make a network request to send a reaction.
   * @param {Object} options
   * @param {Url} options.reactionChannelUrl
   * @param {Reaction} options.reaction
   * @param {string} options.senderID
   * @returns {Promise}
   */
  sendReaction({reactionChannelUrl, reaction, participantId}: SendReactionOptions) {
    const uri = reactionChannelUrl;

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.POST,
      uri,
      body: {
        sender: {participantId},
        reaction,
      },
    });
  }

  /**
   * Make a network request to enable or disable reactions.
   * @param {boolean} options.enable - determines if we need to enable or disable.
   * @param {locusUrl} options.locusUrl
   * @returns {Promise}
   */
  toggleReactions({enable, locusUrl, requestingParticipantId}: ToggleReactionsOptions) {
    const uri = `${locusUrl}/${CONTROLS}`;

    // @ts-ignore
    return this.locusDeltaRequest({
      method: HTTP_VERBS.PUT,
      uri,
      body: {
        reactions: {
          enabled: enable,
        },
        requestingParticipantId,
      },
    });
  }

  getLocusStatusByUrl(locusUrl: string) {
    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.GET,
      uri: locusUrl,
    });
  }
}
