/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

// Browser-safe entry used by the monorepo's webpack alias (`@webex/<pkg>` ->
// `packages/@webex/<pkg>/src/index`). Only the network-free verifier is exposed.
module.exports = require('../verify');
