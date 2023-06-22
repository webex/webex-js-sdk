/* eslint-disable valid-jsdoc */
import {v4 as uuid} from 'uuid';
import {
  CALLING_USER_AGENT,
  CISCO_DEVICE_URL,
  DEVICES_ENDPOINT_RESOURCE,
  SPARK_USER_AGENT,
  WEBEX_WEB_CLIENT,
} from '../constants';
import {ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {ALLOWED_SERVICES, HTTP_METHODS, ServiceData, WebexRequestPayload} from '../../common/types';
import SDKConnector from '../../SDKConnector';
import {IRegistrationClient} from './types';

/**
 *
 */
export class Registration implements IRegistrationClient {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private userId = '';

  private serviceData: ServiceData;

  /**
   * @param webex  -.
   * @param serviceData -.
   */
  constructor(webex: WebexSDK, serviceData: ServiceData) {
    this.sdkConnector = SDKConnector;
    this.serviceData = serviceData;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.userId = this.webex.internal.device.userId;
  }

  /**
   *  Implementation of sending keepalive.
   *
   * @param url - Entire device url.
   * @returns Promise<boolean>.
   */
  public async postKeepAlive(url: string) {
    return <WebexRequestPayload>this.webex.request({
      uri: `${url}/status`,
      method: HTTP_METHODS.POST,
      headers: {
        [CISCO_DEVICE_URL]: this.webex.internal.device.url,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      service: ALLOWED_SERVICES.MOBIUS,
    });
  }

  /**
   * Implementation of delete device.
   *
   * @param url -.
   * @param deviceId -.
   * @param deviceUrl -.
   */
  public async deleteDevice(url: string, deviceId: string, deviceUrl: string) {
    const response = await fetch(`${url}${DEVICES_ENDPOINT_RESOURCE}/${deviceId}`, {
      method: HTTP_METHODS.DELETE,
      headers: {
        [CISCO_DEVICE_URL]: deviceUrl,
        Authorization: await this.webex.credentials.getUserToken(),
        trackingId: `${WEBEX_WEB_CLIENT}_${uuid()}`,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
    });

    return <WebexRequestPayload>response.json();
  }

  /**
   * Implementation of create device.
   *
   * @param url -.
   */
  public async createDevice(url: string) {
    const deviceInfo = {
      userId: this.userId,
      clientDeviceUri: this.webex.internal.device.url,
      serviceData: this.serviceData,
    };

    return <WebexRequestPayload>this.webex.request({
      uri: `${url}device`,
      method: HTTP_METHODS.POST,
      headers: {
        [CISCO_DEVICE_URL]: deviceInfo.clientDeviceUri,
        [SPARK_USER_AGENT]: CALLING_USER_AGENT,
      },
      body: deviceInfo,
      service: ALLOWED_SERVICES.MOBIUS,
    });
  }
}

/**
 * @param webex -.
 * @param serviceData -.
 */
export const createRegistration = (
  webex: WebexSDK,
  serviceData: ServiceData
): IRegistrationClient => new Registration(webex, serviceData);
