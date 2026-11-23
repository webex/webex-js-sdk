/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';

import {assert} from '@webex/test-helper-chai';
import Webex from 'webex';
// As part of npm its trying to pull all the dependencies, internal-media-core
// tries to access the winow object which causes the test to fail. Mocking the
// whole plugin-meetings package.
jest.mock('../../../../@webex/plugin-meetings', () => {
  return {
    someMethod: jest.fn(() => 'mocked value'),
  };
});
jest.mock('@webex/internal-plugin-calendar');

const mockWorker = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
};

global.Worker = jest.fn(() => mockWorker);

global.URL.createObjectURL = function (blob) {
  return 'blob:http://localhost:3000/12345';
};

describe('webex', () => {
  describe('Webex', () => {
    describe('.version', () => {
      it('exists', () => {
        assert.property(Webex, 'version');
        assert.equal(Webex.version, '0.0.0');
      });
    });

    describe('#version', () => {
      it('exists', () => {
        const webex = new Webex();

        assert.property(webex, 'version');
        assert.equal(webex.version, '0.0.0');
      });
    });

    describe('encryption.assetsBaseUrl', () => {
      it('serves assets from the page origin for unversioned builds', () => {
        const webex = Webex.init();

        assert.equal(webex.config.encryption.assetsBaseUrl, '/assets/internal-plugin-encryption/');
      });

      it('can be overridden', () => {
        const assetsBaseUrl = 'https://cdn.example.com/internal-plugin-encryption/';
        const webex = Webex.init({config: {encryption: {assetsBaseUrl}}});

        assert.equal(webex.config.encryption.assetsBaseUrl, assetsBaseUrl);
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

      it('preserves the merged U2C seed when fedramp is true', () => {
        const u2c = Webex.init().config.services.discovery.u2c;

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
        assert.equal(webex.config.services.discovery.u2c, u2c);
        assert.equal(webex.internal.services.get('u2c', 'discovery'), u2c);
      });

      it.each([fedramp.u2c, 'https://u2c.svc.webexgov.us/u2c/api/v1'])(
        'preserves the configured FedRAMP U2C URL %s',
        (u2c) => {
          webex = Webex.init({config: {fedramp: true, services: {discovery: {u2c}}}});

          assert.equal(webex.config.services.discovery.hydra, fedramp.hydra);
          assert.equal(webex.config.services.discovery.u2c, u2c);
          assert.equal(webex.internal.services.get('u2c', 'discovery'), u2c);
        }
      );
    });
  });
});
