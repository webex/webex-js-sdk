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
export {default as ServiceInterceptor} from './interceptors/service';
export {default as ServerErrorInterceptor} from './interceptors/server-error';
export {default as HostMapInterceptor} from './interceptors/hostmap';
export {default as ServiceCatalog} from './service-catalog';
export {default as ServiceRegistry} from './service-registry';
export {default as ServiceState} from './service-state';
export {default as ServiceHost} from './service-host';
export {default as ServiceUrl} from './service-url';
