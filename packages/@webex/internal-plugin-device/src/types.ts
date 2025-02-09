export enum CatalogDetails {
  all = 'all',
  features = 'features',
  websocket = 'websocket',
  none = 'none',
}

export type DeviceRegistrationOptions = {
  includeDetails?: CatalogDetails;
};
