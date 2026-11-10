/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Registers the metrics plugin (and its config) as a side effect.
import '@webex/internal-plugin-device';
import Metrics from '@webex/internal-plugin-metrics';
import WebexCore from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';

// TEMPORARY DEBUG: client metrics can feed themselves (e.g. a failed metrics POST submits
// JS_SDK_SERVICE_NOT_FOUND / JS_SDK_CREDENTIALS_DOWNSCOPE_FAILED, which is POSTed in turn), and
// the batcher's debounce timers then keep the node process alive after the suite finishes.
// Disable client metrics for every instance; tests that sinon.stub() it per instance still work.
Metrics.prototype.submitClientMetrics = function submitClientMetrics() {
  return Promise.resolve();
};

describe('webex-core integration setup', () => {
  it('disables client metrics submission', () => {
    const webex = new WebexCore();

    assert.strictEqual(
      webex.internal.metrics.submitClientMetrics,
      Metrics.prototype.submitClientMetrics
    );
  });
});
