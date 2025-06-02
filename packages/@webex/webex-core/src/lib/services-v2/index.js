/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
// import {registerInternalPlugin} from '../../webex-core';

import * as constants from './constants';
// import ServerErrorInterceptor from './interceptors/server-error';
// import ServiceInterceptor from './interceptors/service';
export {default as ServicesV2} from './services-v2';

// registerInternalPlugin('services', ServicesV2, {
//   interceptors: {
//     ServiceInterceptor: ServiceInterceptor.create,
//     ServerErrorInterceptor: ServerErrorInterceptor.create,
//   },
// });

export {constants};
export {default as ServiceInterceptorV2} from './interceptors/service';
export {default as ServerErrorInterceptorV2} from './interceptors/server-error';
export {default as HostMapInterceptorV2} from './interceptors/hostmap';
export {default as ServiceCatalogV2} from './service-catalog';
export {default as ServiceRegistryV2} from './service-registry';
export {default as ServiceStateV2} from './service-state';
export {default as ServiceHostV2} from './service-host';
export {default as ServiceUrlV2} from './service-url';
