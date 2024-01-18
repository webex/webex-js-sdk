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

const mockUSServiceHosts = [
  {
    host: 'mobius-us-east-1.prod.infra.webex.com',
    ttl: -1,
    priority: 5,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-ca-central-1.prod.infra.webex.com',
    ttl: -1,
    priority: 10,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-eu-central-1.prod.infra.webex.com',
    ttl: -1,
    priority: 15,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-ap-southeast-2.prod.infra.webex.com',
    ttl: -1,
    priority: 20,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
];

const mockEUServiceHosts = [
  {
    host: 'mobius-eu-central-1.prod.infra.webex.com',
    ttl: -1,
    priority: 5,
    id: 'urn:TEAM:eu-central-1_k:mobius',
  },
  {
    host: 'mobius-us-east-1.prod.infra.webex.com',
    ttl: -1,
    priority: 15,
    id: 'urn:TEAM:eu-central-1_k:mobius',
  },
  {
    host: 'mobius-ca-central-1.prod.infra.webex.com',
    ttl: -1,
    priority: 10,
    id: 'urn:TEAM:eu-central-1_k:mobius',
  },
  {
    host: 'mobius-ap-southeast-2.prod.infra.webex.com',
    ttl: -1,
    priority: 20,
    id: 'urn:TEAM:eu-central-1_k:mobius',
  },
];

const mockEUIntServiceHosts = [
  {
    host: 'mobius-eu-central-1.int.infra.webex.com',
    ttl: -1,
    priority: 15,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-us-east-1.int.infra.webex.com',
    ttl: -1,
    priority: 5,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-ca-central-1.int.infra.webex.com',
    ttl: -1,
    priority: 10,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-ap-southeast-2.int.infra.webex.com',
    ttl: -1,
    priority: 20,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
];

const mockIntServiceHosts = [
  {
    host: 'mobius-us-east-1.int.infra.webex.com',
    ttl: -1,
    priority: 5,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-ca-central-1.int.infra.webex.com',
    ttl: -1,
    priority: 10,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-eu-central-1.int.infra.webex.com',
    ttl: -1,
    priority: 15,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
  {
    host: 'mobius-ap-southeast-2.int.infra.webex.com',
    ttl: -1,
    priority: 20,
    id: 'urn:TEAM:us-east-2_a:mobius',
  },
];

const mockCatalogEU = {
  'mobius-eu-central-1.prod.infra.webex.com': mockEUServiceHosts,
};
const mockCatalogEUInt = {
  'mobius-eu-central-1.int.infra.webex.com': mockEUIntServiceHosts,
};

const mockCatalogUS = {
  'mobius-us-east-1.prod.infra.webex.com': mockUSServiceHosts,
  'mobius-eu-central-1.prod.infra.webex.com': mockEUServiceHosts,
};

const mockCatalogUSInt = {
  'mobius-us-east-1.int.infra.webex.com': mockIntServiceHosts,
  'mobius-eu-central-1.int.infra.webex.com': mockEUIntServiceHosts,
};

export {
  ipPayload,
  regionBody,
  regionPayload,
  primaryUrl,
  discoveryPayload,
  registrationPayload,
  uri,
  myIP,
  mockEUServiceHosts,
  mockEUIntServiceHosts,
  mockIntServiceHosts,
  mockUSServiceHosts,
  mockCatalogEU,
  mockCatalogEUInt,
  mockCatalogUS,
  mockCatalogUSInt,
};
