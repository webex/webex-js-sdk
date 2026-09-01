/* eslint-disable require-jsdoc, valid-jsdoc */

import {safeSetTimeout} from '@webex/common-timers';
import uuid from 'uuid';

import {
  createFingerprint,
  removeUrlDetails,
  removeUrlDetailsFromText,
  sanitizeResourceUrl,
  stringifyReason,
  truncate,
} from './utils';

export const UNHANDLED_EXCEPTION_METRIC_NAME = 'JS_SDK_OBSERVED_CLIENT_UNHANDLED_EXCEPTION';

const DEDUPE_WINDOW_MS = 1_000;
const MAX_ERROR_MESSAGE_LENGTH = 4_096;
const MAX_ERROR_NAME_LENGTH = 256;
const MAX_METADATA_LENGTH = 32_000;
const MAX_STACK_LENGTH = 8_192;

const TELEMETRY_LOG_IDENTIFIER = 'Unhandled Exception Telemetry -->';

type ErrorDetails = {
  column?: number;
  filename?: string;
  kind: 'error' | 'unhandledrejection' | 'resource_error';
  line?: number;
  message?: string;
  name: string;
  /** Uppercase DOM tag name, such as SCRIPT, LINK, or IMG; RESOURCE when unavailable. */
  resourceType?: string;
  resourceUrl?: string;
  stack?: string;
};

export type UnhandledExceptionEvent = {
  schemaVersion: 1;
  capturedAt: number;
  eventId: string;
  occurrenceCount: number;
  common: {
    appName: string;
    appVersion?: string;
    runtime: 'browser';
    sdkVersion?: string;
  };
  error: ErrorDetails & {fingerprint: string};
  metadata?: Record<string, unknown>;
  metadataCaptureStatus?: 'invalid_type' | 'provider_error' | 'too_large';
};

type WebexForUnhandledExceptionTelemetry = {
  canAuthorize?: boolean;
  version?: string;
  config?: {
    appName?: string;
    appVersion?: string;
    sdkType?: string;
    metrics?: {
      unhandledExceptionTelemetry?: {
        enabled?: boolean;
        getMetadata?: () => Record<string, unknown> | undefined;
      };
    };
  };
  internal?: {
    metrics?: {
      submitClientMetrics?: (name: string, properties: object, preLoginId?: string) => unknown;
    };
  };
  logger?: {
    error?: (...args: unknown[]) => unknown;
  };
};

function logTelemetryFailure(webex: WebexForUnhandledExceptionTelemetry, message: string): void {
  try {
    webex.logger?.error?.(TELEMETRY_LOG_IDENTIFIER, message);
  } catch {
    // Logging must not turn a telemetry failure into an application failure.
  }
}

/**
 * SDK-owned browser exception reporter with a single in-memory deduplication window.
 */
class UnhandledExceptionTelemetry {
  private readonly pendingEvents = new Map<string, UnhandledExceptionEvent>();
  private readonly eventTarget: Window;
  private readonly errorListener = (event: ErrorEvent) => this.captureError(event);
  private readonly preLoginId: string;
  private readonly rejectionListener = (event: PromiseRejectionEvent) =>
    this.captureRejection(event);

  private readonly webex: WebexForUnhandledExceptionTelemetry;
  private flushTimer?: number | NodeJS.Timeout;

  /**
   * Registers browser listeners after the SDK is ready.
   * @param webex SDK instance used for configuration and submission.
   * @param eventTarget Browser window.
   */
  constructor(webex: WebexForUnhandledExceptionTelemetry, eventTarget: Window) {
    this.webex = webex;
    this.eventTarget = eventTarget;
    this.preLoginId = uuid.v4();
    eventTarget.addEventListener('error', this.errorListener, {capture: true});
    eventTarget.addEventListener('unhandledrejection', this.rejectionListener, {capture: true});
  }

  /**
   * Removes global listeners and either flushes or discards pending events.
   * @param flushPending Whether to submit pending telemetry before teardown.
   * @returns {void}
   */
  stop(flushPending: boolean): void {
    this.eventTarget.removeEventListener('error', this.errorListener, {capture: true});
    this.eventTarget.removeEventListener('unhandledrejection', this.rejectionListener, {
      capture: true,
    });
    this.clearFlushTimer();

    if (flushPending) {
      this.pendingEvents.forEach((event) => this.submit(event));
    }

    this.pendingEvents.clear();
  }

  private captureError(event: ErrorEvent): void {
    try {
      const resourceTarget = event.target;
      const currentSrc = resourceTarget ? Reflect.get(resourceTarget, 'currentSrc') : undefined;
      const src = resourceTarget ? Reflect.get(resourceTarget, 'src') : undefined;
      const href = resourceTarget ? Reflect.get(resourceTarget, 'href') : undefined;
      const rawResourceUrl =
        (typeof currentSrc === 'string' && currentSrc.length > 0 && currentSrc) ||
        (typeof src === 'string' && src.length > 0 && src) ||
        (typeof href === 'string' && href.length > 0 && href) ||
        undefined;

      if (rawResourceUrl) {
        const resourceUrl = sanitizeResourceUrl(rawResourceUrl);

        if (!resourceUrl) {
          return;
        }

        const resourceType = String(
          (resourceTarget && Reflect.get(resourceTarget, 'tagName')) ?? 'RESOURCE'
        ).toUpperCase();

        this.capture({
          kind: 'resource_error',
          message: `Failed to load ${resourceType} resource`,
          name: 'ResourceError',
          resourceType,
          resourceUrl,
        });

        return;
      }

      const {error} = event;
      let message = 'Unknown uncaught error';

      if (typeof error?.message === 'string') {
        message = error.message;
      } else if (typeof event.message === 'string') {
        message = event.message;
      }

      this.capture({
        column: event.colno,
        filename: removeUrlDetails(event.filename),
        kind: 'error',
        line: event.lineno,
        message,
        name: typeof error?.name === 'string' ? error.name : 'Error',
        stack: typeof error?.stack === 'string' ? error.stack : undefined,
      });
    } catch {
      logTelemetryFailure(this.webex, 'Failed to extract an uncaught error.');
    }
  }

  private captureRejection(event: PromiseRejectionEvent): void {
    try {
      const {reason} = event;

      this.capture({
        kind: 'unhandledrejection',
        message: typeof reason?.message === 'string' ? reason.message : stringifyReason(reason),
        name: typeof reason?.name === 'string' ? reason.name : 'UnhandledRejection',
        stack: typeof reason?.stack === 'string' ? reason.stack : undefined,
      });
    } catch {
      logTelemetryFailure(this.webex, 'Failed to extract an unhandled rejection.');
    }
  }

  private capture(details: ErrorDetails): void {
    try {
      const error = {
        ...details,
        name: truncate(removeUrlDetailsFromText(details.name), MAX_ERROR_NAME_LENGTH) ?? 'Error',
        message: truncate(removeUrlDetailsFromText(details.message), MAX_ERROR_MESSAGE_LENGTH),
        stack: truncate(removeUrlDetailsFromText(details.stack), MAX_STACK_LENGTH),
      };
      const fingerprint = createFingerprint(
        [
          error.kind,
          error.name,
          error.message,
          error.stack,
          error.filename,
          error.line,
          error.column,
          error.resourceUrl,
        ].join('|')
      );
      const capturedAt = new Date().getTime();
      const existingEvent = this.pendingEvents.get(fingerprint);

      if (existingEvent) {
        const isWithinDedupeWindow = capturedAt - existingEvent.capturedAt < DEDUPE_WINDOW_MS;

        if (isWithinDedupeWindow) {
          existingEvent.occurrenceCount += 1;

          return;
        }

        // A throttled timer can leave an expired event pending. Its completed window must be
        // submitted before this fingerprint is replaced with a new event and a new window.
        this.pendingEvents.delete(fingerprint);
        this.submit(existingEvent);
      }

      const event: UnhandledExceptionEvent = {
        schemaVersion: 1,
        capturedAt,
        eventId: uuid.v4(),
        occurrenceCount: 1,
        common: {
          appName: this.webex.config?.appName ?? this.webex.config?.sdkType ?? 'webex-js-sdk',
          appVersion: this.webex.config?.appVersion,
          runtime: 'browser',
          sdkVersion: this.webex.version,
        },
        error: {...error, fingerprint},
      };

      this.addMetadata(event);
      this.pendingEvents.set(fingerprint, event);

      if (this.flushTimer === undefined) {
        this.flushTimer = safeSetTimeout(() => this.flush(), DEDUPE_WINDOW_MS);
      }
    } catch {
      logTelemetryFailure(this.webex, 'Failed to capture an exception.');
    }
  }

  private addMetadata(event: UnhandledExceptionEvent): void {
    const getMetadata = this.webex.config?.metrics?.unhandledExceptionTelemetry?.getMetadata;

    if (!getMetadata) {
      return;
    }

    try {
      const metadata = getMetadata();

      if (metadata === undefined) {
        return;
      }

      const serializedMetadata = JSON.stringify(metadata);

      if (serializedMetadata === undefined || serializedMetadata.length > MAX_METADATA_LENGTH) {
        event.metadataCaptureStatus =
          serializedMetadata === undefined ? 'invalid_type' : 'too_large';

        return;
      }

      const parsedMetadata = JSON.parse(serializedMetadata);

      if (
        parsedMetadata === null ||
        typeof parsedMetadata !== 'object' ||
        Array.isArray(parsedMetadata)
      ) {
        event.metadataCaptureStatus = 'invalid_type';

        return;
      }

      event.metadata = parsedMetadata;
    } catch {
      event.metadataCaptureStatus = 'provider_error';
    }
  }

  private flush(): void {
    const now = new Date().getTime();
    let nextFlushInMs: number | undefined;

    this.clearFlushTimer();
    this.pendingEvents.forEach((event, fingerprint) => {
      const remainingWindowMs = DEDUPE_WINDOW_MS - (now - event.capturedAt);

      if (remainingWindowMs <= 0) {
        this.pendingEvents.delete(fingerprint);
        this.submit(event);

        return;
      }

      nextFlushInMs = Math.min(nextFlushInMs ?? remainingWindowMs, remainingWindowMs);
    });

    if (nextFlushInMs !== undefined) {
      this.flushTimer = safeSetTimeout(() => this.flush(), nextFlushInMs);
    }
  }

  private submit(event: UnhandledExceptionEvent): void {
    const submitClientMetrics = this.webex.internal?.metrics?.submitClientMetrics;

    if (!submitClientMetrics) {
      logTelemetryFailure(this.webex, 'submitClientMetrics is unavailable.');

      return;
    }

    try {
      Promise.resolve(
        submitClientMetrics.call(
          this.webex.internal?.metrics,
          UNHANDLED_EXCEPTION_METRIC_NAME,
          {
            tags: {
              app_name: event.common.appName,
              exception_kind: event.error.kind,
              runtime: event.common.runtime,
            },
            fields: {
              captured_at: event.capturedAt,
              error_fingerprint: event.error.fingerprint,
              error_name: event.error.name,
              event_id: event.eventId,
              occurrence_count: event.occurrenceCount,
            },
            eventPayload: event,
          },
          this.webex.canAuthorize === true ? undefined : this.preLoginId
        )
      ).catch(() => {
        logTelemetryFailure(this.webex, 'Failed to submit exception telemetry.');
      });
    } catch {
      logTelemetryFailure(this.webex, 'Failed to submit exception telemetry.');
    }
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}

let activeTelemetry: UnhandledExceptionTelemetry | undefined;

/**
 * Starts browser exception telemetry after SDK readiness.
 * @param webex Initialized SDK instance.
 * @returns {void}
 */
export function startUnhandledExceptionTelemetry(webex: WebexForUnhandledExceptionTelemetry): void {
  const shouldStart =
    webex.config?.metrics?.unhandledExceptionTelemetry?.enabled === true &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function';

  activeTelemetry?.stop(shouldStart);
  activeTelemetry = undefined;

  if (!shouldStart) {
    return;
  }

  try {
    activeTelemetry = new UnhandledExceptionTelemetry(webex, window);
  } catch {
    logTelemetryFailure(webex, 'Failed to start exception telemetry.');
  }
}
