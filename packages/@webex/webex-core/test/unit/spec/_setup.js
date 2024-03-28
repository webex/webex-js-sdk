/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {registerInternalPlugin, registerPlugin, WebexPlugin} from '@webex/webex-core';

// In order to prevent cross talk, make sure the "test" public and private
// plugins are always register to do nothing

beforeEach(() => {
  registerPlugin(
    'test',
    WebexPlugin.extend({
      namespace: 'test',
      session: {
        ready: {
          default: true,
          type: 'boolean',
        },
      },
    }),
    {replace: true}
  );

  registerInternalPlugin(
    'test',
    WebexPlugin.extend({
      namespace: 'test',
      session: {
        ready: {
          default: true,
          type: 'boolean',
        },
      },
    }),
    {replace: true}
  );
});

describe('_setup', () => {
  it('a sample test so that it does not throw an error', () => {
    expect(true).toBeTruthy();
  });
});
