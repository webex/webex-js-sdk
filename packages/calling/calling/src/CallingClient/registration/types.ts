import {WebexRequestPayload} from '../../common/types';

export type Header = {
  [key: string]: string;
};

export interface IRegistrationClient {
  createDevice: (url: string) => Promise<WebexRequestPayload>;
  deleteDevice: (url: string, deviceId: string, deviceUrl: string) => Promise<WebexRequestPayload>;
  postKeepAlive: (_url: string) => Promise<WebexRequestPayload>;
}
