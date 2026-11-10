/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Registers the metrics plugin (and its config) as a side effect.
import '@webex/internal-plugin-device';
import WebexCore, {config} from '@webex/webex-core';
import {assert} from '@webex/test-helper-chai';

// Metrics POSTs that fail with a network error are otherwise re-enqueued forever, and the
// batcher's debounce timers keep the node process alive after the suite finishes. Runs at
// module load so it applies before any spec constructs a webex instance.
config.metrics.batcherRetryOnNetworkError = false;

describe('webex-core integration setup', () => {
  it('disables metrics batcher retries on network errors', () => {
    const webex = new WebexCore();

    assert.isFalse(webex.internal.metrics.config.batcherRetryOnNetworkError);
  });
});
