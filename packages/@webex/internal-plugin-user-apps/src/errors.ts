/* eslint-disable require-jsdoc */
export class UserAppsError extends Error {
  cause?: unknown;

  constructor(message: string, options?: {cause?: unknown}) {
    super(message);
    this.name = 'UserAppsError';
    this.cause = options?.cause;
  }
}

export class UserAppsValidationError extends UserAppsError {
  constructor(message: string) {
    super(message);
    this.name = 'UserAppsValidationError';
  }
}

export class UserAppsSyncError extends UserAppsError {
  statusCode?: number;

  constructor(message: string, options?: {cause?: unknown; statusCode?: number}) {
    super(message, options);
    this.name = 'UserAppsSyncError';
    this.statusCode = options?.statusCode;
  }
}

export class UserAppsEncryptionError extends UserAppsError {
  sectionId?: string;

  constructor(message: string, options?: {cause?: unknown; sectionId?: string}) {
    super(message, options);
    this.name = 'UserAppsEncryptionError';
    this.sectionId = options?.sectionId;
  }
}

export class CatchupResetRequiredError extends UserAppsSyncError {
  constructor(statusCode: number, cause?: unknown) {
    super('User-app catch-up requires a full synchronization', {cause, statusCode});
    this.name = 'CatchupResetRequiredError';
  }
}
