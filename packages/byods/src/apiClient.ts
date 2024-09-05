import BYODS, {SDKConfig} from './BYODS';

const config: SDKConfig = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  accessToken: 'your-initial-access-token',
  refreshToken: 'your-refresh-token',
  expiresAt: new Date('2024-09-15T00:00:00Z'),
};
const sdk = new BYODS(config);

// This function is just a placeholder to test project setup.
async function listDataSources() {
  await sdk.makeAuthenticatedRequest(
    'https://developer-applications.ciscospark.com/v1/dataSources/'
  );
}

// This function is just a placeholder to test project setup.
async function getDataSources(id: string) {
  await sdk.makeAuthenticatedRequest(
    `https://developer-applications.ciscospark.com/v1/dataSources/${id}`
  );
}

export {listDataSources, getDataSources};

export default listDataSources;
