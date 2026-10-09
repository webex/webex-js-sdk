// Minimal stub for @webex/internal-plugin-metrics to allow tests to run in unbuilt monorepo
class RtcMetrics {
  constructor() {}
  addMedia() {}
  addMetrics() {}
  closeMetrics() {}
  sendMetricsInQueue() {}
  updateCallId() {}
}

module.exports = {
  RtcMetrics,
  default: {},
};
