/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@ciscospark/http-core';
import {defaults} from 'lodash';

export default class AutoInstrumentInterceptor extends Interceptor {
  static create(options) {
    return new AutoInstrumentInterceptor({spark: this}, options);
  }

  onResponse(options, response) {
    // We need to make sure we don't go into a loop constantly measuring how
    // long it took to submit this metric. For now, just don't measure traffic
    // sent to the metrics service, but we may want to get more creative at some
    // point. I imagine this Interceptor will get a lot fancier when we try to
    // decorate method calls instead of api calls.
    if (!options.uri.includes(`metrics`) && options.service !== `metrics` && options.api !== `metrics`) {
      this.spark.metrics.submit(`requestTiming`, {
        method: options.method,
        url: options.url,
        timings: options.$timings
      });
    }

    return response;
  }
}
