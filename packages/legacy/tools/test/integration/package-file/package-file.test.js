// const babel = require('@babel/core');
const fs = require('fs/promises');
const fsExtra = require('fs-extra');
const path = require('path');

const { PackageFile } = require('@webex/legacy-tools');

const fixtures = require('./package-file.fixture');

describe('PackageFile', () => {
  describe('instance', () => {
    let packageFile;

    beforeEach(() => {
      packageFile = new PackageFile(fixtures.packageFileConstructorConfig);
    });

    describe('config', () => {
      it('should provide the directory', () => {
        expect(packageFile.config.directory).toBe(
          fixtures.packageFileConstructorConfig.directory,
        );
      });

      it('should provide the location', () => {
        expect(packageFile.config.location).toBe(
          fixtures.packageFileConstructorConfig.location,
        );
      });

      it('should provide the package root', () => {
        expect(packageFile.config.packageRoot).toBe(
          fixtures.packageFileConstructorConfig.packageRoot,
        );
      });
    });

    describe('constructor()', () => {
      it('should map the provided config to the local config property', () => {
        expect(packageFile.config).toBe(fixtures.packageFileConstructorConfig);
      });
    });

    describe('build()', () => {
      const config = {
        destination: 'example/destination',
        generateSourceMap: true,
      };

      const results = {
        PackageFile: {
          transform: {
            code: 'example code',
            map: { example: 'map' },
          },
        },
      };

      const spies = {};

      beforeEach(() => {
        spies.JSON = {
          stringify: spyOn(JSON, 'stringify').and.callThrough(),
        };

        spies.PackageFile = {
          transform: spyOn(PackageFile, 'transform').and.resolveTo(results.PackageFile.transform),
          write: spyOn(PackageFile, 'write').and.resolveTo(undefined),
        };

        spies.path = {
          join: spyOn(path, 'join').and.callThrough(),
        };
      });

      it('should attempt to transform the provided file at the local location', () => packageFile.build(config)
        .then(() => {
          expect(spies.path.join.calls.all()[0].args).toEqual([
            packageFile.config.packageRoot,
            packageFile.config.directory,
            packageFile.config.location,
          ]);

          const location = path.join(
            packageFile.config.packageRoot,
            packageFile.config.directory,
            packageFile.config.location,
          );

          expect(spies.PackageFile.transform.calls.all()[0].args).toEqual([{
            location,
          }]);
        }));

      it('should attempt to create the output path', () => packageFile.build(config)
        .then(() => {
          expect(spies.path.join.calls.all()[1].args).toEqual([
            packageFile.config.packageRoot,
            config.destination,
            packageFile.config.location,
          ]);
        }));

      it('should call "PackageFile.write()" with the provided code and map declaration when generateSourceMap is "true"', () => {
        const outputPath = path.join(
          packageFile.config.packageRoot,
          config.destination,
          packageFile.config.location,
        );

        const mutatedCode = `${results.PackageFile.transform.code}\n//# sourceMappingURL=${path.basename(outputPath)}.map\n`;

        return packageFile.build(config)
          .then(() => {
            expect(spies.PackageFile.write.calls.all()[0].args).toEqual([{
              data: mutatedCode,
              destination: outputPath,
            }]);
          });
      });

      it('should not call "PackageFile.write()" when the code is not provided', () => {
        spies.PackageFile.transform.and.resolveTo({});

        return packageFile.build(config)
          .then(() => {
            expect(spies.PackageFile.write).toHaveBeenCalledTimes(0);
          });
      });

      it('should call "PackageFile.write()" with the provided code and no map declaration when generateSourceMap is "false"', () => {
        const outputPath = path.join(
          packageFile.config.packageRoot,
          config.destination,
          packageFile.config.location,
        );

        return packageFile.build({ ...config, generateSourceMap: false })
          .then(() => {
            expect(spies.PackageFile.write.calls.all()[0].args).toEqual([{
              data: results.PackageFile.transform.code,
              destination: outputPath,
            }]);
          });
      });

      it('should call "PackageFile.write()" with the provided sourcemap when generateSourceMap is "true"', () => {
        const outputPath = path.join(
          packageFile.config.packageRoot,
          config.destination,
          packageFile.config.location,
        );

        return packageFile.build(config)
          .then(() => {
            expect(spies.PackageFile.write.calls.all()[1].args).toEqual([{
              data: JSON.stringify(results.PackageFile.transform.map),
              destination: `${outputPath}.map`,
            }]);
          });
      });

      it('should not call "PackageFile.write()" with the provided sourcemap when generateSourceMap is "false"', () => packageFile.build({ ...config, generateSourceMap: false })
        .then(() => {
          expect(spies.PackageFile.write).toHaveBeenCalledTimes(1);
        }));

      it('should return itself', () => packageFile.build(config)
        .then((resolved) => {
          expect(resolved).toBe(packageFile);
        }));
    });
  });

  describe('static', () => {
    describe('transform()', () => {
      const config = {
        location: 'example/location',
      };

      it('should return a promise', () => {
        expect(PackageFile.transform(config) instanceof Promise).toBeTrue();
      });
    });

    describe('write()', () => {
      const config = {
        data: 'example data',
        destination: 'example/destination',
      };

      const spies = {};

      beforeEach(() => {
        spies.fsExtra = {
          ensureDir: spyOn(fsExtra, 'ensureDir').and.resolveTo(undefined),
        };

        spies.fs = {
          writeFile: spyOn(fs, 'writeFile').and.resolveTo(undefined),
        };
      });

      it('should call "fsExtra.ensureDir()" with the destination and resolving function', () => PackageFile.write(config)
        .then(() => {
          expect(spies.fsExtra.ensureDir.calls.all()[0].args[0]).toBe(
            path.dirname(config.destination),
          );
        }));

      it('should call "fs.writeFile" with the destination and data', () => PackageFile.write(config)
        .then(() => {
          expect(spies.fs.writeFile).toHaveBeenCalledWith(
            config.destination,
            config.data,
          );
        }));
    });
  });
});
