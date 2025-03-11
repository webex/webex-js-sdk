/* eslint-disable no-underscore-dangle */
/* eslint-disable valid-jsdoc */
import {CallerIdInfo} from '../../../Events/types';
import {ISDKConnector, WebexSDK} from '../../../SDKConnector/types';
import {DisplayInformation} from '../../../common/types';
import log from '../../../Logger/index';
import {CALLER_ID_FILE, VALID_PHONE_REGEX} from '../../constants';

import SDKConnector from '../../../SDKConnector';
import {ICallerId} from './types';
import {CallEmitterCallBack} from '../types';
import {resolveCallerIdDisplay} from '../../../common';

/**
 *
 */
export class CallerId implements ICallerId {
  private webex: WebexSDK;

  private callerInfo: DisplayInformation;

  private sdkConnector: ISDKConnector;

  private emitter: CallEmitterCallBack;

  /**
   * Start the callerId instance.
   *
   * @param webex -.
   * @param callObj -.
   * @param emitter -.
   */
  constructor(webex: WebexSDK, emitter: CallEmitterCallBack) {
    this.sdkConnector = SDKConnector;
    this.callerInfo = {} as DisplayInformation;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.emitter = emitter;
  }

  /**
   * The handler which processes the data received from the SCIM query
   * performed through externalId.
   *
   * @param filter - A filter to be used for query.
   */
  private async resolveCallerId(filter: string) {
    const displayResult = (await resolveCallerIdDisplay(filter)) as DisplayInformation;
    let isChanged = false;

    /* It makes sense to emit only if the resolution gives different results than what we already have.
     * Note that results gathered from the SCIM Query is always given preference.
     */
    if (displayResult.name && this.callerInfo.name !== displayResult.name) {
      log.info('Updating Name after resolution', {
        file: CALLER_ID_FILE,
        method: 'resolveCallerId',
      });
      this.callerInfo.name = displayResult.name;
      isChanged = true;
    }

    if (displayResult.num && this.callerInfo.num !== displayResult.num) {
      log.info('Updating Number after resolution', {
        file: CALLER_ID_FILE,
        method: 'resolveCallerId',
      });
      this.callerInfo.num = displayResult.num;
      isChanged = true;
    }

    if (!this.callerInfo.avatarSrc || this.callerInfo.avatarSrc !== displayResult.avatarSrc) {
      log.info('Updating Avatar Id after resolution', {
        file: CALLER_ID_FILE,
        method: 'resolveCallerId',
      });
      this.callerInfo.avatarSrc = displayResult.avatarSrc;
      isChanged = true;
    }

    if (!this.callerInfo.id || this.callerInfo.id !== displayResult.id) {
      log.info('Updating User Id after resolution', {
        file: CALLER_ID_FILE,
        method: 'resolveCallerId',
      });
      this.callerInfo.id = displayResult.id;
      isChanged = true;
    }

    if (isChanged) {
      this.emitter(this.callerInfo);
    }
  }

  /**
   *  Remote party Id parser.
   *
   * @param data - Entire URI string.
   */
  private async parseRemotePartyInfo(data: string) {
    /* External Id will be the last token if at all it exists */
    const lastToken = data.split(';').slice(-1)[0];

    if (lastToken.includes('externalId')) {
      const externalId = lastToken.split('=')[1];

      log.info(`externalId retrieved: ${externalId}`, {
        file: CALLER_ID_FILE,
        method: 'parseRemotePartyInfo',
      });

      this.resolveCallerId(`id eq "${externalId}"`);
    } else {
      log.warn(`externalId not found!`, {
        file: CALLER_ID_FILE,
        method: 'parseRemotePartyInfo',
      });
    }
  }

  /**
   *  Parser for SIP Uris.
   *
   * @param paid - Entire sip uri. Can be PA-Id or From header.
   * @returns -  a collection of name and number.
   * @example
   * const paid1 = '"John O' Connor - (Guest)" <sip:1234567890@domain>';
   * const result1 = parseSipUri(paid1);
   * result1.name = "John O' Connor - (Guest)"
   * result1.num = "1234567890"
   */
  private parseSipUri(paid: string): DisplayInformation {
    const result = {} as DisplayInformation;

    // Extract name
    const nameMatch = paid.split('<')[0].replace(/"/g, '');
    if (nameMatch) {
      result.name = nameMatch.trim();
    } else {
      log.warn(`Name field not found!`, {
        file: CALLER_ID_FILE,
        method: 'parseSipUri',
      });
    }

    // Extract number
    const data = paid.split('@')[0].replace(/"/g, '');
    const num = data.substring(data.indexOf(':') + 1, data.length);
    const phoneMatch = num.match(VALID_PHONE_REGEX);

    if (phoneMatch && phoneMatch[0].length === num.length) {
      result.num = num;
    } else {
      log.warn(`Number field not found!`, {
        file: CALLER_ID_FILE,
        method: 'parseSipUri',
      });
    }

    return result;
  }

  /**
   * The main entrypoint of the Caller-Id instance.
   * It returns intermediate name and number and starts the
   * caller Id resolution in background.
   *
   * @param callerId - CallerId data passed to us by Call Instance.
   * @returns - A collection of name and number.
   */
  public fetchCallerDetails(callerId: CallerIdInfo) {
    /* resetting previously set fields */
    this.callerInfo.id = undefined;
    this.callerInfo.avatarSrc = undefined;
    this.callerInfo.name = undefined;
    this.callerInfo.num = undefined;

    if ('p-asserted-identity' in callerId) {
      log.info('Parsing p-asserted-identity within remote party information', {
        file: CALLER_ID_FILE,
        method: 'fetchCallerDetails',
      });
      const result = this.parseSipUri(callerId['p-asserted-identity'] as string);

      /* For P-Asserted-Identity, we update the callerInfo blindly, as it is of highest preference */
      this.callerInfo.name = result.name;
      this.callerInfo.num = result.num;
    }

    if (callerId.from) {
      log.info('Parsing from header within the remote party information', {
        file: CALLER_ID_FILE,
        method: 'fetchCallerDetails',
      });

      const result = this.parseSipUri(callerId.from);

      /* For From header , we should only update if not filled already by P-Asserted-Identity */
      if (!this.callerInfo.name && result.name) {
        log.info('Updating name field from From header', {
          file: CALLER_ID_FILE,
          method: 'fetchCallerDetails',
        });
        this.callerInfo.name = result.name;
      }

      if (!this.callerInfo.num && result.num) {
        log.info('Updating number field from From header', {
          file: CALLER_ID_FILE,
          method: 'fetchCallerDetails',
        });
        this.callerInfo.num = result.num;
      }
    }

    /* Emit the intermediate CallerId */

    if (this.callerInfo.name || this.callerInfo.num) {
      this.emitter(this.callerInfo);
    }

    /* We need to parse x-broadworks-remote-party-info if present asynchronously */
    if ('x-broadworks-remote-party-info' in callerId) {
      log.info('Parsing x-broadworks-remote-party-info within remote party information', {
        file: CALLER_ID_FILE,
        method: 'fetchCallerDetails',
      });

      this.parseRemotePartyInfo(callerId['x-broadworks-remote-party-info'] as string);
    }

    return this.callerInfo;
  }
}

/**
 * To create CallerId instance.
 *
 * @param webex -.
 * @param emitterCb -.
 */
export const createCallerId = (webex: WebexSDK, emitterCb: CallEmitterCallBack): ICallerId =>
  new CallerId(webex, emitterCb);
