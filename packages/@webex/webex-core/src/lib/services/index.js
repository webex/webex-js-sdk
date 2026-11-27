/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Services v1 is no longer registered by default; `ServicesV2` is. Apps that
// still need v1 can register it themselves:
// registerInternalPlugin('services', Services, {interceptors: {...}, replace: true});
export {default as Services} from './services';
export {default as ServiceCatalog} from './service-catalog';
export {default as ServiceRegistry} from './service-registry';
export {default as ServiceState} from './service-state';
export {default as ServiceHost} from './service-host';
export {default as ServiceUrl} from './service-url';
