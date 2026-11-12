const KarmaRunner = require('karma');
const { Karma } = require('@webex/legacy-tools');

describe('Karma', () => {
  describe('static', () => {
    describe('Browsers', () => {
      const { Browsers } = Karma;

      describe('static', () => {
        describe('CONSTANTS', () => {
          it('should return an object with all necessary keys', () => {
            expect(Object.keys(Browsers.CONSTANTS)).toEqual(['CHROME', 'CHROME_COMMON', 'FIREFOX', 'FIREFOX_COMMON']);
          });
        });
      });

      describe('get()', () => {
        it('should assign default headed browsers if debug was provided without browsers', () => {
          const browsers = Browsers.get({ debug: true });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.CHROME.HEADED,
            ...Browsers.CONSTANTS.FIREFOX.HEADED,
          });
        });

        it('should assign default headless browsers if debug and browsers were not provided', () => {
          const browsers = Browsers.get({ debug: false });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.CHROME.HEADLESS,
            ...Browsers.CONSTANTS.FIREFOX.HEADLESS,
          });
        });

        it('should provide an empty object when the provided browser is not supported', () => {
          const browsers = Browsers.get({ browsers: ['invalid'] });

          expect(browsers).toEqual({});
        });

        it('should normalize a single browser string', () => {
          const browsers = Browsers.get({ browsers: 'chrome' });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.CHROME.HEADLESS,
          });
        });

        it('should provide a headed chrome browser when debug is enabled', () => {
          const browsers = Browsers.get({ debug: true, browsers: ['chrome'] });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.CHROME.HEADED,
          });
        });

        it('should provide a headless chrome browser when debug is disabled', () => {
          const browsers = Browsers.get({ debug: false, browsers: ['chrome'] });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.CHROME.HEADLESS,
          });
        });

        it('should provide a headed firefox browser when debug is enabled', () => {
          const browsers = Browsers.get({ debug: true, browsers: ['firefox'] });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.FIREFOX.HEADED,
          });
        });

        it('should provide a headless firefox browser when debug is disabled', () => {
          const browsers = Browsers.get({ debug: false, browsers: ['firefox'] });

          expect(browsers).toEqual({
            ...Browsers.CONSTANTS.FIREFOX.HEADLESS,
          });
        });
      });
    });

    describe('CONSTANTS', () => {
      it('should return an object with all necessary keys', () => {
        expect(Object.keys(Karma.CONSTANTS)).toEqual(['CONFIG']);
      });
    });

    describe('test()', () => {
      let config;
      const spies = {};
      const mocks = {};
      const eventCallback = {};

      beforeEach(() => {
        config = {
          files: ['@webex/test/file1.js', 'file2.js', 'file3.js'],
        };

        mocks.KarmaRunner = {
          ServerConstructor: (data, callback) => {
            const timeout = setTimeout(() => {
              callback(0);

              clearTimeout(timeout);
            }, 10);
          },
          Server: class Server {
            constructor(...args) {
              mocks.KarmaRunner.ServerConstructor(...args);
            }

            start() { return this; }

            on(event, callback) { eventCallback[event] = callback; return this; }
          },
        };

        mocks.Browsers = {
          get: ({ browsers }) => (browsers ? browsers.reduce((output, browser) => ({
            ...output, [browser]: browser,
          }), {}) : {}),
        };

        spies.Karma = {
          Browsers: {
            get: spyOn(Karma.Browsers, 'get').and.callFake(mocks.Browsers.get),
          },
          Https: {
            isEnabled: spyOn(Karma.Https, 'isEnabled').and.returnValue(false),
            setup: spyOn(Karma.Https, 'setup'),
          },
        };

        spies.KarmaRunner = {
          config: {
            parseConfig: spyOn(KarmaRunner.config, 'parseConfig').and.resolveTo({}),
          },
          Server: {
            constructor: spyOn(KarmaRunner, 'Server').and.callFake(mocks.KarmaRunner.Server),
            start: spyOn(mocks.KarmaRunner.Server.prototype, 'start').and.returnValue(undefined),
          },
        };
      });

      it('should attempt to get the karmaConfig browsers based on the provided browsers without debug', () => {
        const browsers = ['chrome', 'firefox'];

        return Karma.test({ browsers })
          .then(() => {
            expect(spies.Karma.Browsers.get.calls.all()[0].args).toEqual([{
              browsers,
              debug: undefined,
            }]);
          });
      });

      it('should attempt to get the karmaConfig browsers based on the provided browsers with debug', () => {
        const browsers = ['chrome', 'firefox'];

        return Karma.test({ browsers, debug: true })
          .then(() => {
            expect(spies.Karma.Browsers.get.calls.all()[0].args).toEqual([{
              browsers,
              debug: true,
            }]);
          });
      });

      it('should provide the browsers value in the karma config', () => {
        const browsers = ['chrome', 'firefox'];

        return Karma.test({ browsers })
          .then(() => {
            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].browsers).toEqual(
              browsers,
            );
          });
      });

      it('should provide the customLanchers value in the karma config', () => {
        const browsers = ['chrome', 'firefox'];
        const customLaunchers = Karma.Browsers.get({ browsers });

        return Karma.test({ browsers })
          .then(() => {
            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].customLaunchers)
              .toEqual(
                customLaunchers,
              );
          });
      });

      it('should provide the files value in the karma config', () => Karma.test(config)
        .then(() => {
          expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].files)
            .toEqual(
              config.files,
            );
        }));

      it('should provide the port value in the karma config', () => {
        const port = '1234';
        const portNumber = parseInt(port, 10);

        return Karma.test({ port })
          .then(() => {
            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].port)
              .toBe(portNumber);

            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].proxies['/fixtures/'])
              .toBe(`http://localhost:${portNumber - 1}`);

            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].proxies['/upload'])
              .toBe(`http://localhost:${portNumber - 1}/upload`);
          });
      });

      it('should provide the singleRun value as the opposite of the provided debug value in the karma config', () => {
        const debug = true;

        return Karma.test({ debug })
          .then(() => {
            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].singleRun)
              .toBe(!debug);
          });
      });

      it('should provide the browserify.watch value as the provided debug value in the karma config', () => {
        const debug = true;

        return Karma.test({ debug })
          .then(() => {
            expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1].browserify.watch)
              .toBe(debug);
          });
      });

      it('should provide null as the first parameter of the karma config parse', () => Karma.test({})
        .then(() => {
          expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[0]).toBe(null);
        }));

      it('should provide standard overrides as the third parameter of the karma config parse', () => Karma.test({})
        .then(() => {
          expect(spies.KarmaRunner.config.parseConfig.calls.all()[0].args[2]).toEqual({
            promiseConfig: true,
            throwErrors: true,
          });
        }));

      it('should reject on server creation if the provided code is not 0', () => {
        spyOn(mocks.KarmaRunner, 'ServerConstructor').and.callFake((data, callback) => { callback(1); });

        return expectAsync(Karma.test(config)).toBeRejected();
      });

      it('should call server.start', () => Karma.test(config)
        .then(() => {
          expect(spies.KarmaRunner.Server.start).toHaveBeenCalledTimes(1);
        }));

      it('should start the server', async () => {
        spyOn(console, 'log');
        await Karma.test({ config });

        expect(spies.KarmaRunner.Server.start).toHaveBeenCalledTimes(1);

        eventCallback.run_start();

        expect(console.log).toHaveBeenCalledWith('Tests run started');

        eventCallback.run_complete();

        expect(console.log).toHaveBeenCalledWith('Test run complete');
      });

      it('should not set up https when it is not enabled', () => Karma.test(config)
        .then(() => {
          const karmaConfig = spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1];

          expect(spies.Karma.Https.setup).not.toHaveBeenCalled();
          expect(karmaConfig.protocol).toBeUndefined();
          expect(karmaConfig.httpsServerOptions).toBeUndefined();
        }));

      it('should reject when the karma config cannot be parsed and https is not enabled', () => {
        spies.KarmaRunner.config.parseConfig.and.rejectWith(new Error('bad config'));

        return expectAsync(Karma.test(config)).toBeRejectedWithError('bad config');
      });

      describe('when https is enabled', () => {
        let https;

        beforeEach(() => {
          https = {
            cert: 'cert',
            key: 'key',
            createFirefoxProfile: jasmine.createSpy('createFirefoxProfile').and.returnValue('/tmp/profile'),
            cleanup: jasmine.createSpy('cleanup'),
          };

          spies.Karma.Https.isEnabled.and.returnValue(true);
          spies.Karma.Https.setup.and.returnValue(https);
          spies.Karma.Browsers.get.and.returnValue({
            Chrome: { base: 'ChromeHeadless', flags: ['--chrome'] },
            Firefox: { base: 'FirefoxHeadless', prefs: { pref: true } },
          });
        });

        it('should serve karma over https on the https hostname and port', () => Karma.test(config)
          .then(() => {
            const karmaConfig = spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1];

            expect(karmaConfig.protocol).toBe('https:');
            expect(karmaConfig.hostname).toBe(Karma.Https.HOSTNAME);
            expect(karmaConfig.port).toBe(Karma.Https.PORT);
            expect(karmaConfig.httpsServerOptions).toEqual({ key: 'key', cert: 'cert' });
          }));

        it('should keep proxying to the test server based on the requested karma port', () => Karma.test({ ...config, port: '1234' })
          .then(() => {
            const { proxies } = spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1];

            expect(proxies['/fixtures/']).toBe('http://localhost:1233');
            expect(proxies['/upload']).toBe('http://localhost:1233/upload');
            expect(proxies['/assets/']).toBe('http://localhost:1233/assets/');
          }));

        it('should give firefox launchers a profile that trusts the CA without mutating the browser configs', () => {
          const browserConfigs = spies.Karma.Browsers.get();

          return Karma.test(config)
            .then(() => {
              const karmaConfig = spies.KarmaRunner.config.parseConfig.calls.all()[0].args[1];

              expect(karmaConfig.customLaunchers).toEqual({
                Chrome: { base: 'ChromeHeadless', flags: ['--chrome'] },
                Firefox: { base: 'FirefoxHeadless', prefs: { pref: true }, profile: '/tmp/profile' },
              });

              expect(browserConfigs.Firefox.profile).toBeUndefined();
              expect(https.createFirefoxProfile).toHaveBeenCalledTimes(1);
            });
        });

        it('should clean up once the run completes', () => Karma.test(config)
          .then(() => {
            expect(https.cleanup).toHaveBeenCalledTimes(1);
          }));

        it('should clean up when the karma config cannot be parsed', () => {
          spies.KarmaRunner.config.parseConfig.and.rejectWith(new Error('bad config'));

          return expectAsync(Karma.test(config)).toBeRejectedWithError('bad config')
            .then(() => {
              expect(https.cleanup).toHaveBeenCalledTimes(1);
            });
        });

        it('should clean up when a firefox profile cannot be created', () => {
          https.createFirefoxProfile.and.throwError(new Error('no certutil'));

          return expectAsync(Karma.test(config)).toBeRejectedWithError('no certutil')
            .then(() => {
              expect(https.cleanup).toHaveBeenCalledTimes(1);
            });
        });
      });
    });
  });
});
