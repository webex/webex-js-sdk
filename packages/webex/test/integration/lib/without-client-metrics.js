/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */
import sinon from 'sinon';

/**
 * Prevent telemetry from keeping an SDK integration fixture alive.
 * These tests exercise initialization and HTTP, not metrics. A failed metrics
 * POST can itself generate a client metric, repeatedly scheduling batch timers
 * after the suite finishes (also covered by the core token/catalog tests).
 * Keep the stub for this instance's lifetime, including test-user deletion.
 * @param {Object} webex - SDK fixture.
 * @returns {Object} The same SDK fixture.
 */
export default function withoutClientMetrics(webex) {
  sinon.stub(webex.internal.metrics, 'submitClientMetrics').resolves();

  return webex;
}
