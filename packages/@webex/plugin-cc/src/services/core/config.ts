/* eslint-disable @typescript-eslint/no-explicit-any */
export const KEEPALIVE_WORKER_INTERVAL = 4000;
export const NOTIFS_RESOLVE_DELAY = 1200;
export const CLOSE_SOCKET_TIMEOUT_DURATION = 16000;
export const PING_API_URL = '/health';
export const WELCOME_TIMEOUT = 30000;
// eslint-disable-next-line no-restricted-globals
export const METHOD_NAME = location && location.host.includes('localhost') ? 'GET' : 'HEAD';
export const RTD_PING_EVENT = 'rtd-online-status';

// export const CONF: {readonly [k in keyof AgentxServicesConfig]: AgentxServicesConfig[k]} =
//   {} as any;
// export function setAgentxServicesConfig(config: AgentxServicesConfig) {
//   Object.keys(config).forEach((k) => ((CONF as any)[k] = config[k as keyof AgentxServicesConfig]));
// }

// let auth: any;
// export const getAuthService = () => auth;
// export const setAuthService = (authService: any) => {
//   auth = authService;
// };
