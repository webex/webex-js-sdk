/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

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
