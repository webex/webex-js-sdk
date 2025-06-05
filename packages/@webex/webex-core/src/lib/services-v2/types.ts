export type ServiceUrl = {
  baseUrl: string;
  host: string;
  priority: number;
  failed?: boolean;
};

export type ActiveServices = Record<string, string>;
export type Service = {
  id: string;
  serviceName: string;
  serviceUrls: Array<ServiceUrl>;
};
export type QueryOptions = {
  email?: string;
  orgId?: string;
  userId?: string;
  timestamp?: number;
};

export interface ServiceHostmap {
  activeServices: ActiveServices;
  services: Array<Service>;
  timeStamp: string;
  orgId: string;
  format: string;
}

export interface IServiceDetail {
  id: string;
  serviceName: string;
  serviceUrls: Array<ServiceUrl>;
  failHost(url: string): boolean;
  get(): string;
}

export interface IServiceCatalog {
  serviceGroups: {
    discovery: Array<IServiceDetail>;
    override: Array<IServiceDetail>;
    preauth: Array<IServiceDetail>;
    postauth: Array<IServiceDetail>;
    signin: Array<IServiceDetail>;
  };
  status: {
    discovery: {ready: boolean; collecting: boolean};
    override: {ready: boolean; collecting: boolean};
    preauth: {ready: boolean; collecting: boolean};
    postauth: {ready: boolean; collecting: boolean};
    signin: {ready: boolean; collecting: boolean};
  };
  isReady: boolean;
  allowedDomains: string[];
  clean(): void;
  findClusterId(url: string): string | undefined;
  findServiceFromClusterId(params: {
    clusterId: string;
    serviceGroup?: string;
  }): {name: string; url: string} | undefined;
  findServiceDetailFromUrl(url: string): IServiceDetail | undefined;
  findAllowedDomain(url: string): string | undefined;
  get(clusterId: string, serviceGroup: string): string | undefined;
  getAllowedDomains(): string[];
  markFailedServiceUrl(url: string): string | undefined;
  setAllowedDomains(allowedDomains: string[]): void;
  addAllowedDomains(newAllowedDomains: string[]): void;
  updateServiceGroups(serviceGroup: string, serviceDetails: Array<IServiceDetail>): void;
  waitForCatalog(serviceGroup: string, timeout?: number): Promise<void>;
}
