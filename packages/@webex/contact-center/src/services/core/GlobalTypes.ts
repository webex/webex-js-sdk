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
