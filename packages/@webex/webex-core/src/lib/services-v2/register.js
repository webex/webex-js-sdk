/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import {registerInternalPlugin} from '../../webex-core';

import ServicesV2 from './services-v2';
import ServerErrorInterceptor from '../interceptors/server-error';
import ServiceInterceptor from '../interceptors/service';

registerInternalPlugin('services', ServicesV2, {
  interceptors: {
    ServiceInterceptor: ServiceInterceptor.create,
    ServerErrorInterceptor: ServerErrorInterceptor.create,
  },
});
