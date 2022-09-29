/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {registerInternalPlugin} from '../../webex-core';

import * as constants from './constants';
import Services from './services';
import ServerErrorInterceptor from './interceptors/server-error';
import ServiceInterceptor from './interceptors/service';

registerInternalPlugin('services', Services, {
  interceptors: {
    ServiceInterceptor: ServiceInterceptor.create,
    ServerErrorInterceptor: ServerErrorInterceptor.create
  }
});

export {constants};
export {default as ServiceInterceptor} from './interceptors/service';
export {default as ServerErrorInterceptor} from './interceptors/server-error';
export {default as Services} from './services';
export {default as ServiceCatalog} from './service-catalog';
export {default as ServiceRegistry} from './service-registry';
export {default as ServiceState} from './service-state';
export {default as ServiceHost} from './service-host';
export {default as ServiceUrl} from './service-url';
