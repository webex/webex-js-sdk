import {IMetaContext} from '../Logger/types';

export type ErrorMessage = string;

export enum ERROR_TYPE {
  DEFAULT = 'default_error',
  FORBIDDEN_ERROR = 'forbidden',
  NOT_FOUND = 'not_found',
  REGISTRATION_ERROR = 'registration_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT = 'timeout',
  TOKEN_ERROR = 'token_error',
  SERVER_ERROR = 'server_error',
}

export enum ERROR_CODE {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  DEVICE_NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503,
  BAD_REQUEST = 400,
  REQUEST_TIMEOUT = 408,
  TOO_MANY_REQUESTS = 429,
}

// Disable ESLint for empty interface as it may be extended in the future
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ErrorContext extends IMetaContext {}

export type ErrorObject = {
  message: ErrorMessage;
  type: ERROR_TYPE;
  context: ErrorContext;
};
