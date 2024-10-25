export interface AgentLoginRequest {
  dialNumber: string;
  teamId?: string;
  isExtension?: boolean;
  roles: string[];
  deviceType?: string;
  deviceId?: string;
}
