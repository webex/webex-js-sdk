import WebexNode from '../../../src/webex-node';
// const defaultConfig = require('../../../src/config'); // Use if you need to inspect config defaults

describe('WebexNode', () => {
    describe('init()', () => {
        it('should create an instance of WebexNode with default configuration', () => {
            const instance = WebexNode.init();
            expect(typeof instance).toBe('object');
            // Verify that the expected property exists; adjust as appropriate if your implementation differs.
            expect(instance.webex).toBe(true);
            expect(instance.config).toBeInstanceOf(Object);
            expect(instance.config.sdkType).toBe('webex-node');
        });

        it('should merge user provided config with the default configuration', () => {
            const customConfig = {foo: 'bar'};
            const instance = WebexNode.init({config: customConfig});
            expect(instance.config).toBeInstanceOf(Object);
            // The default value should still be present.
            expect(instance.config.sdkType).toBe('webex-node');
            // The custom config property must be merged.
            expect(instance.config.foo).toBe('bar');
        });

        it('should override default config with user provided configuration', () => {
            const customConfig = {sdkType: 'custom-node', extra: 'value'};
            const instance = WebexNode.init({config: customConfig});
            expect(instance.config).toBeInstanceOf(Object);
            // Since custom config should override default for matching keys.
            expect(instance.config.sdkType).toBe('custom-node');
            expect(instance.config.extra).toBe('value');
        });
    });

    describe('fedramp', () => {
        let webex;

        const fedramp = {
        hydra: 'https://api-usgov.webex.com/v1',
        u2c: 'https://u2c.gov.ciscospark.com/u2c/api/v1',
        };

        it('is set false by default', () => {
            webex = new WebexNode();
            expect(webex.config.fedramp).toBe(false);
        });

        it('sets correct services when fedramp is true', () => {
            webex = WebexNode.init({
                config: {
                    fedramp: true,
                },
                    credentials: {
                    access_token: process.env.token,
                },
            });

            expect(webex.config).toHaveProperty('fedramp');
            expect(webex.config.fedramp).toBe(true);
            expect(webex.config.services).toHaveProperty('discovery');
            expect(webex.config.services.discovery.hydra).toBe(fedramp.hydra);
            expect(webex.config.services.discovery.u2c).toBe(fedramp.u2c);
        });
    });
});
