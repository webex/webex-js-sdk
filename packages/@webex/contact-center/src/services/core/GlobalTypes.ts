/**
 * Generic message interface used throughout the plugin
 * @template T - Type of the data payload (defaults to any)
 * @private
 * @ignore
 */
export type Msg<T = any> = {
  /** Message/Event type identifier */
  type: string;
  /** Organization identifier */
  orgId: string;
  /** Unique tracking identifier for the message/Event */
  trackingId: string;
  /** Message/Event payload data */
  data: T;
};

/**
 * Represents a failure message with specific error details
 * @private
 * @ignore
 */
export type Failure = Msg<{
  /** Agent identifier associated with the failure */
  agentId: string;
  /** Tracking identifier for the failure event */
  trackingId: string;
  /** Numeric code indicating the reason for failure */
  reasonCode: number;
  /** Organization identifier */
  orgId: string;
  /** Human-readable description of the failure reason */
  reason: string;
}>;

/**
 * Represents task API error details in a structured format
 * @public
 */
export interface TaskError {
  /** Original error object for throwing */
  error: Error;
  /** Unique tracking identifier for correlation */
  trackingId: string;
  /** Detailed error message from the API */
  errorMessage: string;
  /** Type/category of the error (e.g., "Bad Request") */
  errorType: string;
  /** Additional error context data */
  errorData: string;
  /** Numeric reason code */
  reasonCode: number;
}

/**
 * An Error object augmented with a flexible data field for additional context.
 * Use this to attach structured data to thrown errors without ts-ignore.
 */
export interface AugmentedError extends Error {
  data?: Record<string, any>;
}
