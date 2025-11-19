type ServiceName = string;
type ClusterId = string;
export type ServiceGroup = 'discovery' | 'override' | 'preauth' | 'postauth' | 'signin';

export type ServiceHost = {
  host: string;
  ttl: number;
  priority: number;
  id: string;
  homeCluster?: boolean;
};

export type ServiceUrl = {
  baseUrl: string;
  host: string;
  priority: number;
  failed?: boolean;
};

export type ActiveServices = Record<ServiceName, ClusterId>;
export type Service = {
  id: ClusterId;
  serviceName: ServiceName;
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
  timestamp: string;
  orgId: string;
  format: string;
}

export interface IServiceDetail {
  id: ClusterId;
  serviceName: ServiceName;
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
    clusterId: ClusterId;
    serviceGroup?: ServiceGroup;
  }): {name: string; url: string} | undefined;
  findServiceDetailFromUrl(url: string): IServiceDetail | undefined;
  findAllowedDomain(url: string): string | undefined;
  get(clusterId: ClusterId, serviceGroup?: ServiceGroup): string | undefined;
  getAllowedDomains(): string[];
  markFailedServiceUrl(url: string): string | undefined;
  setAllowedDomains(allowedDomains: string[]): void;
  addAllowedDomains(newAllowedDomains: string[]): void;
  updateServiceGroups(serviceGroup: ServiceGroup, serviceDetails: Array<IServiceDetail>): void;
  waitForCatalog(serviceGroup: ServiceGroup, timeout?: number): Promise<void>;
}
