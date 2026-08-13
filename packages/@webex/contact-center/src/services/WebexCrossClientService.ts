import LoggerProxy from '../logger-proxy';
import {METHODS} from '../constants';
import {WebexSDK} from '../types';

const WEBEX_CROSS_CLIENT_FILE = 'WebexCrossClientService';
const DEFAULT_CROSS_CLIENT_STATE_TTL = 900;
const EXPIRATION_OFFSET_MS = 60_000;
/** Must match Agent Desktop usersub publish — Webex App reads `wxcc` cross-client state. */
const DEFAULT_APP_NAME = 'wxcc';

type RefreshTimer = ReturnType<typeof setTimeout>;

/**
 * Publishes usersub cross-client state so Webex App suppresses native calling toasts (WXCC-6026).
 */
export default class WebexCrossClientService {
  private webex: WebexSDK;
  private refreshTimer?: RefreshTimer;
  private answerCallsState = false;
  private appName = DEFAULT_APP_NAME;

  constructor(webex: WebexSDK) {
    this.webex = webex;
  }

  private extractDeviceIdFromUrl(url: string): string {
    const match = url.match(/\/devices\/([^/?]+)/);

    return match ? match[1] : '';
  }

  private getDeviceUrl(): string | undefined {
    return this.webex.internal.device?.url;
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private startRefreshTimer(userId: string, ttl: number): void {
    this.clearRefreshTimer();

    if (!this.answerCallsState) {
      return;
    }

    const refreshTime = ttl * 1000 - EXPIRATION_OFFSET_MS;
    this.refreshTimer = setTimeout(() => {
      this.setManageWebexCallingInWxcc(true, {userId, ttl, appName: this.appName}).catch(
        (error) => {
          LoggerProxy.error(`WebexCrossClientService refresh failed: ${error}`, {
            module: WEBEX_CROSS_CLIENT_FILE,
            method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
          });
        }
      );
    }, refreshTime);
  }

  private publishCrossClientState(
    users: string[],
    ttl: number,
    composition: Record<string, unknown>,
    logContext: string
  ): Promise<unknown> {
    const body = {
      users,
      compositions: [
        {
          type: 'cross-client-state',
          ttl,
          composition,
        },
      ],
    };

    return this.webex
      .request({
        method: 'POST',
        service: 'usersub',
        resource: 'publish',
        body,
      })
      .then((response: {body?: unknown}) => response?.body)
      .catch((error: unknown) => {
        LoggerProxy.error(`WebexCrossClientService.${logContext} failed: ${error}`, {
          module: WEBEX_CROSS_CLIENT_FILE,
          method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
        });

        return Promise.reject(error);
      });
  }

  public async setManageWebexCallingInWxcc(
    enable: boolean,
    options?: {userId?: string; ttl?: number; appName?: string}
  ): Promise<void> {
    const userId = options?.userId ?? this.webex.internal.device?.userId;
    const ttl = options?.ttl ?? DEFAULT_CROSS_CLIENT_STATE_TTL;
    const appName = options?.appName ?? DEFAULT_APP_NAME;
    this.appName = appName;

    if (!userId) {
      throw new Error('User ID is unavailable for cross-client publish');
    }

    const deviceUrl = this.getDeviceUrl();
    if (!deviceUrl) {
      throw new Error('Device URL is unavailable for cross-client publish');
    }

    const composition = {
      devices: [
        {
          deviceId: this.extractDeviceIdFromUrl(deviceUrl),
          appName,
          state: {
            'answer-calls-on-wxcc': enable,
          },
        },
      ],
    };

    await this.publishCrossClientState([userId], ttl, composition, 'setManageWebexCallingInWxcc');
    this.answerCallsState = enable;

    if (enable) {
      this.startRefreshTimer(userId, ttl);
    } else {
      this.clearRefreshTimer();
    }

    LoggerProxy.info(`Cross-client answer-calls-on-wxcc set to ${enable}`, {
      module: WEBEX_CROSS_CLIENT_FILE,
      method: METHODS.SET_MANAGE_WEBEX_CALLING_IN_WXCC,
      data: {
        appName,
        deviceId: this.extractDeviceIdFromUrl(deviceUrl),
        ttl,
      },
    });
  }

  public teardown(): void {
    this.clearRefreshTimer();
    this.answerCallsState = false;
  }
}
