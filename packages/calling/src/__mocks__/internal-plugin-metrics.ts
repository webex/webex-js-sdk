// Minimal stub for @webex/internal-plugin-metrics used in unit tests.
// The calling package only imports RtcMetrics from this package.
// In tests, actual RtcMetrics construction is not exercised directly.

export class RtcMetrics {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-useless-constructor
  constructor(_webex?: unknown, _options?: unknown, _correlationId?: unknown) {}
  sendMetricsInQueue = jest.fn();
  closeMetrics = jest.fn();
  updateCallId = jest.fn();
}

export default {};
