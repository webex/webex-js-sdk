const glob = require('glob');
const path = require('path');

const {
  Jest,
  Karma,
  Mocha,
  Package,
  PackageFile,
} = require('@webex/legacy-tools');

describe('Package', () => {
  describe('instance', () => {
    let pack;

    beforeEach(() => {
      pack = new Package();
    });

    describe('data', () => {
      it('should provide the package root location', () => {
        expect(pack.data.packageRoot).toBeDefined();
      });
    });

    describe('build()', () => {
      const spies = {};

      const config = {
        destination: 'destination/example',
        generateSourceMaps: true,
        javascript: true,
        source: 'source/example',
        typescript: true,
      };

      const results = {
        Package: {
          getFiles: ['file1.js', 'file2.js', 'file3.js'],
        },
      };

      beforeEach(() => {
        spies.Package = {
          getFiles: spyOn(Package, 'getFiles').and.resolveTo(results.Package.getFiles),
        };

        spies.PackageFile = {
          build: spyOn(PackageFile.prototype, 'build').and.resolveTo(undefined),
        };

        spies.path = {
          join: spyOn(path, 'join').and.callThrough(),
        };
      });

      it('should attempt to join the package root with the source', () => pack.build(config)
        .then(() => {
          expect(spies.path.join.calls.all()[0].args).toEqual([
            pack.data.packageRoot,
            config.source,
          ]);
        }));

      it('should call getFiles with a javascript pattern when javascript is provided', () => pack.build(config)
        .then(() => {
          expect(spies.Package.getFiles.calls.all()[0].args).toEqual([{
            location: path.join(pack.data.packageRoot, config.source),
            pattern: './**/*.js',
          }]);
        }));

      it('should not call getFiles with javascript when javascript is not truthy', () => pack.build({ ...config, javascript: false })
        .then(() => {
          expect(spies.Package.getFiles).toHaveBeenCalledTimes(1);
          expect(spies.Package.getFiles.calls.all()[0].args).toEqual([{
            location: path.join(pack.data.packageRoot, config.source),
            pattern: './**/*.ts',
          }]);
        }));

      it('should call getFiles with a typescript pattern when typescript is provided', () => pack.build(config)
        .then(() => {
          expect(spies.Package.getFiles.calls.all()[1].args).toEqual([{
            location: path.join(pack.data.packageRoot, config.source),
            pattern: './**/*.ts',
          }]);
        }));

      it('should not call getFiles with typescript when typescript is not truthy', () => pack.build({ ...config, typescript: false })
        .then(() => {
          expect(spies.Package.getFiles).toHaveBeenCalledTimes(1);
          expect(spies.Package.getFiles.calls.all()[0].args).toEqual([{
            location: path.join(pack.data.packageRoot, config.source),
            pattern: './**/*.js',
          }]);
        }));

      it('should call "PackageFile.build()" for each found file with appropriate params', () => pack.build(config)
        .then(() => {
          expect(spies.PackageFile.build).toHaveBeenCalledTimes(
            results.Package.getFiles.length * 2,
          );

          const mergedTargets = [...results.Package.getFiles, ...results.Package.getFiles];

          mergedTargets.forEach((target, i) => {
            expect(spies.PackageFile.build.calls.all()[i].args).toEqual([{
              destination: config.destination,
              generateSourceMap: !!config.generateSourceMaps,
            }]);
          });
        }));

      it('should resolve to itself', () => pack.build(config)
        .then((result) => {
          expect(result).toBe(pack);
        }));
    });

    describe('test()', () => {
      let config;

      const spies = {};

      const results = {
        Package: {
          getFiles: ['file1.js', 'file2.js', 'file3.js'],
        },
      };

      beforeEach(() => {
        config = {
          integration: true,
          unit: true,
        };

        spies.Package = {
          getFiles: spyOn(Package, 'getFiles').and.resolveTo(results.Package.getFiles),
        };

        spies.path = {
          join: spyOn(path, 'join').and.callThrough(),
        };

        spies.Jest = {
          test: spyOn(Jest, 'test').and.resolveTo(undefined),
        };

        spies.Mocha = {
          test: spyOn(Mocha, 'test').and.resolveTo(undefined),
        };

        spies.Karma = {
          test: spyOn(Karma, 'test').and.resolveTo(undefined),
        };
      });

      it('should attempt to join the package root with the test directory', () => pack.test(config)
        .then(() => {
          expect(spies.path.join.calls.all()[0].args).toEqual([
            pack.data.packageRoot,
            Package.CONSTANTS.TEST_DIRECTORIES.ROOT,
          ]);
        }));

      it('should attempt to get files within the unit test directory if unit is provided', () => {
        const testDirectory = path.join(
          pack.data.packageRoot,
          Package.CONSTANTS.TEST_DIRECTORIES.ROOT,
        );

        return pack.test(config)
          .then(() => {
            expect(spies.Package.getFiles.calls.all()[0].args).toEqual([{
              location: path.join(testDirectory, Package.CONSTANTS.TEST_DIRECTORIES.UNIT),
              pattern: Package.CONSTANTS.PATTERNS.TEST,
            }]);
          });
      });

      it('should not attempt to get files within the unit test directory if unit is not provided', () => {
        const testDirectory = path.join(
          pack.data.packageRoot,
          Package.CONSTANTS.TEST_DIRECTORIES.ROOT,
        );

        config.unit = false;

        return pack.test(config)
          .then(() => {
            expect(spies.Package.getFiles).toHaveBeenCalledTimes(1);
            expect(spies.Package.getFiles.calls.all()[0].args).toEqual([{
              location: path.join(testDirectory, Package.CONSTANTS.TEST_DIRECTORIES.INTEGRATION),
              pattern: Package.CONSTANTS.PATTERNS.TEST,
            }]);
          });
      });

      it('should attempt to get files within the integration test directory if integration is provided', () => {
        const testDirectory = path.join(
          pack.data.packageRoot,
          Package.CONSTANTS.TEST_DIRECTORIES.ROOT,
        );

        return pack.test(config)
          .then(() => {
            expect(spies.Package.getFiles.calls.all()[1].args).toEqual([{
              location: path.join(testDirectory, Package.CONSTANTS.TEST_DIRECTORIES.INTEGRATION),
              pattern: Package.CONSTANTS.PATTERNS.TEST,
            }]);
          });
      });

      it('should not attempt to get files within the integration test directory if integration is not provided', () => {
        const testDirectory = path.join(
          pack.data.packageRoot,
          Package.CONSTANTS.TEST_DIRECTORIES.ROOT,
        );

        config.integration = false;

        return pack.test(config)
          .then(() => {
            expect(spies.Package.getFiles).toHaveBeenCalledTimes(1);
            expect(spies.Package.getFiles.calls.all()[0].args).toEqual([{
              location: path.join(testDirectory, Package.CONSTANTS.TEST_DIRECTORIES.UNIT),
              pattern: Package.CONSTANTS.PATTERNS.TEST,
            }]);
          });
      });

      it('should call "Jest.test()" with files when runner is set to "jest"', () => pack.test({ ...config, runner: 'jest' })
        .then(() => {
          expect(spies.Jest.test).toHaveBeenCalledTimes(1);
          expect(spies.Jest.test.calls.all()[0].args).toEqual([{
            files: results.Package.getFiles,
          }]);
        }));

      it('should not call "Jest.test()" with files if the located unit files 0 or less when runner is set to "jest"', () => {
        spies.Package.getFiles.and.resolveTo([]);

        return pack.test({ ...config, runner: 'jest' })
          .then(() => {
            expect(spies.Jest.test).toHaveBeenCalledTimes(0);
          });
      });

      it('should call "Mocha.test()" with files if the located unit and integration files are greater than 0 when runner is set to "mocha"', () => pack.test({ ...config, runner: 'mocha' })
        .then(() => {
          expect(spies.Mocha.test).toHaveBeenCalledTimes(1);
          expect(spies.Mocha.test.calls.all()[0].args).toEqual([{
            files: [...results.Package.getFiles, ...results.Package.getFiles],
          }]);
        }));

      it('should not call "Mocha.test()" with files if the located unit and integration files 0 or less when runner is set to "mocha"', () => {
        spies.Package.getFiles.and.resolveTo([]);

        return pack.test({ ...config, runner: 'mocha' })
          .then(() => {
            expect(spies.Mocha.test).toHaveBeenCalledTimes(0);
          });
      });

      it('should call "Karma.test()" with files if the located unit and integration files are greater than 0 when runner is set to "karma"', () => {
        const karmaBrowsers = ['chrome', 'firefox'];
        const karmaDebug = true;
        const karmaPort = '1234';
        const runner = 'karma';

        return pack.test({
          ...config, karmaBrowsers, karmaDebug, karmaPort, runner,
        })
          .then(() => {
            expect(spies.Karma.test).toHaveBeenCalledTimes(1);
            expect(spies.Karma.test.calls.all()[0].args[0].browsers).toEqual(karmaBrowsers);
            expect(spies.Karma.test.calls.all()[0].args[0].debug).toBe(karmaDebug);
            expect(spies.Karma.test.calls.all()[0].args[0].port).toBe(karmaPort);
            expect(spies.Karma.test.calls.all()[0].args[0].files)
              .toEqual([...results.Package.getFiles, ...results.Package.getFiles]);
          });
      });

      it('should not call "Karma.test()" with files if the located unit and integration files 0 or less when runner is set to "karma"', () => {
        spies.Package.getFiles.and.resolveTo([]);

        return pack.test({ ...config, runner: 'karma' })
          .then(() => {
            expect(spies.Mocha.test).toHaveBeenCalledTimes(0);
          });
      });

      it('should return itself', () => pack.test(config)
        .then((self) => {
          expect(self).toBe(pack);
        }));
    });
  });

  describe('static', () => {
    describe('getFiles()', () => {
      const config = {
        location: 'example/location',
        pattern: 'example/pattern',
      };

      const results = {
        glob: {
          glob: [
            'example-result-a',
            'example-result-b',
          ],
        },
      };

      const spies = {};

      beforeEach(() => {
        spies.path = {
          join: spyOn(path, 'join').and.callThrough(),
        };

        spies.glob = {
          glob: spyOn(glob, 'glob').and.resolveTo(results.glob.glob),
        };
      });

      it('should call "path.join()" with the provided location and pattern', () => Package.getFiles(config)
        .then(() => {
          expect(spies.path.join).toHaveBeenCalledOnceWith(config.location, config.pattern);
        }));

      it('should call "glob.glob()" with the merged target', () => {
        const target = path.join(config.location, config.pattern);

        return Package.getFiles(config)
          .then(() => {
            expect(spies.glob.glob).toHaveBeenCalledOnceWith(target);
          });
      });

      it('should return the results of the glob call', () => Promise.all([Package.getFiles(config), glob.glob()])
        .then(([resolved, expected]) => {
          expect(resolved).toEqual(expected);
        }));
    });
  });
});
