/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */

import MockWebex from '@webex/test-helper-mock-webex';
import {Services, ServicesV2} from '@webex/webex-core';
import describeServicesContract from '../../../fixtures/services-contract';
import {serviceHostmapV2} from '../../../fixtures/host-catalog-v2';

[
  {
    name: 'v1',
    plugin: Services,
    populate: (services) =>
      services
        ._getCatalog()
        .updateServiceUrls('postauth', [
          {name: 'conversation', defaultUrl: 'https://conversation.example.com/api/v1', hosts: []},
        ]),
  },
  {
    name: 'v2',
    plugin: ServicesV2,
    populate: (services) => {
      const hostMap = services._formatReceivedHostmap(JSON.parse(JSON.stringify(serviceHostmapV2)));
      services._getCatalog().updateServiceGroups('postauth', hostMap.services, hostMap.timestamp);
    },
  },
].forEach(({name, plugin, populate}) => {
  describe(`services ${name} offline contract`, () => {
    let services;

    beforeEach(() => {
      const webex = new MockWebex({children: {services: plugin}});
      services = webex.internal.services;
      webex.config.services = {
        discovery: {},
        allowedDomains: [],
        servicesNotNeedValidation: [],
      };
      services.initConfig();
      populate(services);
    });

    describeServicesContract(() => services);
  });
});
