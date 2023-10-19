/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Webex from 'webex';
import sinon from 'sinon';

describe('webex', () => {
  const fakeServices =  {
    _serviceUrls: {
      mobius: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1',
      identity: 'https://identity-b-us.webex.com',
      janus: 'https://janus-intb.ciscospark.com/janus/api/v1',
      wdm: 'https://wdm-a.wbx2.com/wdm/api/v1',
      broadworksIdpProxy: 'https://broadworks-idp-proxy-a.wbx2.com/broadworks-idp-proxy/api/v1',
      hydra: 'https://hydra-a.wbx2.com/v1/',
      mercuryApi: 'https://mercury-api-intb.ciscospark.com/v1',
      'ucmgmt-gateway': 'https://gw.telemetry.int-ucmgmt.cisco.com',
      contactsService: 'https://contacts-service-a.wbx2.com/contact/api/v1',
      directorySearch: 'https://directory-search-a.wbx2.com/direcory-search/api/v1/',
    },
    fetchClientRegionInfo: jest.fn(),
  }

  describe('Webex', () => {

    describe('.version', () => {
      it('exists', () => {
        assert.property(Webex, 'version');
        assert.equal(Webex.version, "modern");
      });
    });

    describe('#version', () => {
      it('exists', () => {
        const webex = new Webex();

        const servicesGetStub = sinon.stub(webex.internal.services, 'get');
        servicesGetStub.withArgs('wdm').returns(true);

        const waitForCatalogStub = sinon.stub(webex.internal.services, 'waitForCatalog');
        waitForCatalogStub.withArgs('postauth', 10).resolves();

        const waitForServiceStub = sinon.stub(webex.internal.services, 'waitForService');
        waitForServiceStub.withArgs({name: 'wdm'}).resolves('https://wdm-a.wbx2.com/wdm/api/v1');
        waitForServiceStub.withArgs({name: 'u2c'}).resolves('https://u2c.gov.ciscospark.com/u2c/api/v1');

        webex.canAuthorize = true;
        const getUserTokenStub = sinon.stub(webex.internal.credentials, 'getUserToken');
        getUserTokenStub.withArgs('spark:all').resolves('token');

        assert.property(webex, 'version');
        assert.equal(webex.version, "modern");
      });
    });

    describe('fedramp', () => {
      let webex;

      const fedramp = {
        hydra: 'https://api-usgov.webex.com/v1',
        u2c: 'https://u2c.gov.ciscospark.com/u2c/api/v1',
      };

      it('is set false by default', () => {
        webex = new Webex();
        assert.equal(webex.config.fedramp, false);
      });

      it('sets correct services when fedramp is true', () => {
        webex = Webex.init({
          config: {
            fedramp: true,
          },
          credentials: {
            access_token: process.env.token,
          },
        });

        assert.property(webex.config, 'fedramp');
        assert.equal(webex.config.fedramp, true);
        assert.property(webex.config.services, 'discovery');
        assert.equal(webex.config.services.discovery.hydra, fedramp.hydra);
        assert.equal(webex.config.services.discovery.u2c, fedramp.u2c);
      });
    });
  });
});
