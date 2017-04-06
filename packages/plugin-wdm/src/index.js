/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {registerPlugin} from '@ciscospark/spark-core';
import Device from './device';
import config from './config';

import UrlInterceptor from './interceptors/url';
import DeviceAuthInterceptor from './interceptors/auth';
import DeviceUrlInterceptor from './interceptors/device-url';
import EmbargoInterceptor from './interceptors/embargo';

registerPlugin(`device`, Device, {
  interceptors: {
    UrlInterceptor: UrlInterceptor.create,
    AuthInterceptor: DeviceAuthInterceptor.create,
    DeviceUrlInterceptor: DeviceUrlInterceptor.create,
    EmbargoInterceptor: EmbargoInterceptor.create
  },
  config
});

export {default as default} from './device';
export {default as Device} from './device';
export {default as FeaturesModel} from './device/features-model';
export {default as FeatureCollection} from './device/feature-collection';
export {default as FeatureModel} from './device/feature-model';
export {default as AuthInterceptor} from './interceptors/auth';
export {default as EmbargoInterceptor} from './interceptors/embargo';
export {default as UrlInterceptor} from './interceptors/url';
export {default as DeviceUrlInterceptor} from './interceptors/device-url';
