import {getMobiusDiscoveryResponse, getTestUtilsWebex} from '../common/testUtil';
import {MobiusServers, WebexRequestPayload} from '../common/types';
import {URL_ENDPOINT} from './constants';
import {mockPostResponse} from './registration/registerFixtures';

const webex = getTestUtilsWebex();

const mockIPReturnBody = {
  ipv4: '1.1.1.1',
  ipv6: '2.2.2.2',
};

const ipPayload = <WebexRequestPayload>(<unknown>{
  statusCode: 200,
  body: mockIPReturnBody,
});

const regionBody = {
  attribution:
    'This product includes GeoLite2 data created by MaxMind, available from http://www.maxmind.com',
  clientAddress: '72.163.220.6',
  clientRegion: 'AP-SOUTHEAST',
  countryCode: 'IN',
  disclaimer:
    'This service is intended for use by Webex Team only. Unauthorized use is prohibited.',
  regionCode: 'AP-SOUTHEAST',
  timezone: 'Asia/Kolkata',
};

const regionPayload = <WebexRequestPayload>(<unknown>{
  statusCode: 200,
  body: regionBody,
});

const discoveryBody: MobiusServers = getMobiusDiscoveryResponse();
const primaryUrl = `${discoveryBody.primary.uris[0]}/calling/web/`;
const discoveryPayload = <WebexRequestPayload>(<unknown>{
  statusCode: 200,
  body: discoveryBody,
});

const registrationPayload = <WebexRequestPayload>(<unknown>{
  statusCode: 200,
  body: mockPostResponse,
});

const uri = `${webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`;
const myIP = mockIPReturnBody.ipv4;

export {
  ipPayload,
  regionBody,
  regionPayload,
  primaryUrl,
  discoveryPayload,
  registrationPayload,
  uri,
  myIP,
};
