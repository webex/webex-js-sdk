/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */
const WebexCore = require('@webex/webex-core').default;
require('@webex/internal-plugin-metrics');
require('@babel/register')({ignore: [/[/\\]node_modules[/\\]/]});
const withoutClientMetrics = require('../lib/without-client-metrics').default;

// Like Mocha, observe rejections without forcibly exiting. Without the fixture
// helper, missing-service telemetry feeds itself and its timers prevent exit.
process.on('unhandledRejection', () => {});
const client = withoutClientMetrics(
  new WebexCore({
    config: {
      logger: {level: 'silent'},
      services: {skipPreauthCatalogOnUnauthenticated: true},
      metrics: {batcherWait: 10, batcherMaxWait: 20, waitForServiceTimeout: 0.01},
    },
  })
);

client.internal.metrics.submitClientMetrics('test.missing.metrics.service').catch(() => {});
// No process.exit(): the parent test verifies that Node exits naturally.
