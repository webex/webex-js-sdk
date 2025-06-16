export type ServiceUrl = {
  baseUrl: string;
  host: string;
  priority: number;
  failed?: boolean;
};

export interface IServiceDetail {
  id: string;
  serviceName: string;
  serviceUrls: Array<ServiceUrl>;
  failHost(url: string): boolean;
}
