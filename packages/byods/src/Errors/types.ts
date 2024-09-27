import {IMetaContext} from '../Logger/types';

export type ErrorMessage = string;

export enum ERROR_LAYER {
  CALL_CONTROL = 'call_control',
  MEDIA = 'media',
}

export enum ERROR_TYPE {
  CALL_ERROR = 'call_error',
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

export enum CALL_ERROR_CODE {
  INVALID_STATUS_UPDATE = 111,
  DEVICE_NOT_REGISTERED = 112,
  CALL_NOT_FOUND = 113,
  ERROR_PROCESSING = 114,
  USER_BUSY = 115,
  PARSING_ERROR = 116,
  TIMEOUT_ERROR = 117,
  NOT_ACCEPTABLE = 118,
  CALL_REJECTED = 119,
  NOT_AVAILABLE = 120,
}

export enum DEVICE_ERROR_CODE {
  DEVICE_LIMIT_EXCEEDED = 101,
  DEVICE_CREATION_DISABLED = 102,
  DEVICE_CREATION_FAILED = 103,
}

export interface ErrorContext extends IMetaContext {}

export type ErrorObject = {
  message: ErrorMessage;
  type: ERROR_TYPE;
  context: ErrorContext;
};

