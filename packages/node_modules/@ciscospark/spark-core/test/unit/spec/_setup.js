/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin, registerPlugin, SparkPlugin} from '@ciscospark/spark-core';

// In order to prevent cross talk, make sure the "test" public and private
// plugins are always register to do nothing

beforeEach(() => {
  registerPlugin('test', SparkPlugin.extend({
    namespace: 'test',
    session: {
      ready: {
        default: true,
        type: 'boolean'
      }
    }
  }), {replace: true});

  registerInternalPlugin('test', SparkPlugin.extend({
    namespace: 'test',
    session: {
      ready: {
        default: true,
        type: 'boolean'
      }
    }
  }), {replace: true});
});
