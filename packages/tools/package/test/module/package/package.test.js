const fs = require('fs/promises');
const path = require('path');
const { Package, Yarn } = require('@webex/package-tools');

const fixtures = require('./package.fixture');

describe('Package', () => {
  describe('instance', () => {
    let pack;

    beforeEach(() => {
      pack = new Package(fixtures.packageConstructorConfig);
    });

    describe('data', () => {
      it('should store the provided package location', () => {
        expect(pack.data.location).toBe(fixtures.packageConstructorConfig.location);
      });

      it('should store the provided package name', () => {
        expect(pack.data.name).toBe(fixtures.packageConstructorConfig.name);
      });

      it('should store the provided package tag', () => {
        expect(pack.data.version.tag).toBe(fixtures.packageConstructorConfig.tag);
      });
    });

    describe('name', () => {
      it('should reflect the provided package name', () => {
        expect(pack.name).toBe(pack.data.name);
      });

      it('should be immutable', () => {
        pack.name = 'new-package-name';

        expect(pack.name).toBe(fixtures.packageConstructorConfig.name);
      });
    });

    describe('version', () => {
      const version = '1.2.3-example-tag.4';

      beforeEach(() => {
        pack.setVersion(Package.parseVersionStringToObject(version));
      });

      it('should reflect the provided package version as a string', () => {
        expect(pack.version).toBe(version);
      });

      it('should be immutable', () => {
        pack.version = 'example-package-version';

        expect(pack.version).toBe(version);
      });
    });

    describe('constructor()', () => {
      it('should assign the data object', () => {
        expect(pack.data).toBeDefined();
      });

      it('should assign the default tag if no tag was provided', () => {
        pack = new Package({
          location: fixtures.packageConstructorConfig.location,
          name: fixtures.packageConstructorConfig.name,
        });

        expect(pack.data.version.tag).toBe(Package.CONSTANTS.STABLE_TAG);
      });
    });

    describe('apply()', () => {
      const examplePath = 'example-path';
      const version = '1.2.3-example-tag.4';
      const definition = { version };
      const spies = {};

      beforeEach(() => {
        pack.setVersion(Package.parseVersionStringToObject(version));

        spies.Package = {
          readDefinition: jest.spyOn(Package, 'readDefinition').mockResolvedValue(definition),
        };

        spies.fs = {
          writeFile: jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined),
        };

        spies.path = {
          join: jest.spyOn(path, 'join').mockReturnValue(examplePath),
        };
      });

      it('should return a promise that resolves to itself', () => pack.apply()
        .then((results) => {
          expect(results).toBe(pack);
        }));

      it('should attempt to ammend the package definition file to the package path', () => pack.apply()
        .then(() => {
          expect(spies.path.join).toHaveBeenCalledTimes(1);
          expect(spies.path.join).toHaveBeenCalledWith(
            pack.data.location,
            Package.CONSTANTS.PACKAGE_DEFINITION_FILE,
          );
        }));

      it('should attempt to read the file at the package definition location', () => pack.apply()
        .then(() => {
          expect(spies.Package.readDefinition).toHaveBeenCalledTimes(1);
          expect(spies.Package.readDefinition).toHaveBeenCalledWith({
            definitionPath: examplePath,
          });
        }));

      it('should attempt to write the local version to the file at the definition location', () => {
        const data = `${JSON.stringify(definition, null, 2)}\n`;

        return pack.apply()
          .then(() => {
            expect(spies.fs.writeFile).toHaveBeenCalledTimes(1);
            expect(spies.fs.writeFile).toHaveBeenCalledWith(examplePath, data);
          });
      });
    });

    describe('hasScript()', () => {
      const examplePath = 'example-path';
      const exampleScript = 'example-script';
      const definition = {
        scripts: {
          [exampleScript]: 'example-execution',
        },
      };
      const spies = {};

      beforeEach(() => {
        spies.Package = {
          readDefinition: jest.spyOn(Package, 'readDefinition').mockResolvedValue(definition),
        };

        spies.path = {
          join: jest.spyOn(path, 'join').mockReturnValue(examplePath),
        };
      });

      it('should return a promise that resolves to a boolean', () => pack.hasScript(exampleScript)
        .then((results) => {
          expect(typeof results).toBe('boolean');
        }));

      it('should attempt to ammend the package definition file to the package path', () => pack.hasScript(exampleScript)
        .then(() => {
          expect(spies.path.join).toHaveBeenCalledTimes(1);
          expect(spies.path.join).toHaveBeenCalledWith(
            pack.data.location,
            Package.CONSTANTS.PACKAGE_DEFINITION_FILE,
          );
        }));

      it('should attempt to read the file at the package definition location', () => pack.hasScript(examplePath)
        .then(() => {
          expect(spies.Package.readDefinition).toHaveBeenCalledTimes(1);
          expect(spies.Package.readDefinition).toHaveBeenCalledWith({
            definitionPath: examplePath,
          });
        }));

      it('should return false if the definition has no scripts', () => {
        spies.Package.readDefinition.mockResolvedValue({});

        return pack.hasScript(exampleScript)
          .then((results) => {
            expect(results).toBe(false);
          });
      });

      it(
        'should return false if the definition does not have the provided script',
        () => pack.hasScript('another-example-script')
          .then((results) => {
            expect(results).toBe(false);
          }),
      );

      it('should return true if the definition has the provided script', () => pack.hasScript(exampleScript)
        .then((results) => {
          expect(results).toBe(true);
        }));
    });

    describe('incrementVersion()', () => {
      const exampleVersion = 1234;
      const versionObject = Package.parseVersionStringToObject('1.2.3-example-tag.4');
      const spies = {};

      beforeEach(() => {
        pack.data.version = {
          ...versionObject,
        };

        spies.pack = {
          setVersion: jest.spyOn(pack, 'setVersion').mockReturnValue(pack),
        };
      });

      it(
        'should increment and flatten from the major verison when only a major version is provided',
        () => {
          pack.incrementVersion({ major: exampleVersion });

          expect(spies.pack.setVersion).toHaveBeenCalledTimes(1);
          expect(spies.pack.setVersion)
            .toHaveBeenCalledWith(
              expect.objectContaining({
                major: exampleVersion + versionObject.major,
                minor: 0,
                patch: 0,
                release: 0,
                tag: versionObject.tag,
              }),
            );
        },
      );

      it(
        'should increment and flatten from the minor verison when only a major version is provided',
        () => {
          pack.incrementVersion({ minor: exampleVersion });

          expect(spies.pack.setVersion).toHaveBeenCalledTimes(1);
          expect(spies.pack.setVersion)
            .toHaveBeenCalledWith(
              expect.objectContaining({
                major: versionObject.major,
                minor: exampleVersion + versionObject.minor,
                patch: 0,
                release: 0,
                tag: versionObject.tag,
              }),
            );
        },
      );

      it(
        'should increment and flatten from the patch verison when only a major version is provided',
        () => {
          pack.incrementVersion({ patch: exampleVersion });

          expect(spies.pack.setVersion).toHaveBeenCalledTimes(1);
          expect(spies.pack.setVersion)
            .toHaveBeenCalledWith(
              expect.objectContaining({
                major: versionObject.major,
                minor: versionObject.minor,
                patch: exampleVersion + versionObject.patch,
                release: 0,
                tag: versionObject.tag,
              }),
            );
        },
      );

      it(
        'should increment and flatten from the release verison when only a major version is provided',
        () => {
          pack.incrementVersion({ release: exampleVersion });

          expect(spies.pack.setVersion).toHaveBeenCalledTimes(1);
          expect(spies.pack.setVersion)
            .toHaveBeenCalledWith(
              expect.objectContaining({
                major: versionObject.major,
                minor: versionObject.minor,
                patch: versionObject.patch,
                release: exampleVersion + versionObject.release,
                tag: versionObject.tag,
              }),
            );
        },
      );

      it('should increment the release version if the tag does not match the stable tag', () => {
        pack.incrementVersion({ tag: versionObject.tag });

        expect(spies.pack.setVersion).toHaveBeenCalledTimes(1);
        expect(spies.pack.setVersion)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              major: versionObject.major,
              minor: versionObject.minor,
              patch: versionObject.patch,
              release: versionObject.release + 1,
              tag: versionObject.tag,
            }),
          );
      });

      it('should increment the patch version if no version object is provided', () => {
        pack.data.version.tag = Package.CONSTANTS.STABLE_TAG;
        pack.incrementVersion();

        expect(spies.pack.setVersion).toHaveBeenCalledTimes(1);
        expect(spies.pack.setVersion)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              major: versionObject.major,
              minor: versionObject.minor,
              patch: versionObject.patch + 1,
              release: versionObject.release,
              tag: pack.data.version.tag,
            }),
          );
      });
    });

    describe('inspect()', () => {
      const exampleVersion = 'example-version';
      const exampleTag = 'example-tag';
      const inspectResults = {
        version: '4.5.6',
        'dist-tags': {
          [exampleTag]: '1.2.3-example-tag.4',
          [Package.CONSTANTS.STABLE_TAG]: '4.5.6',
        },
      };

      const spies = {};

      beforeEach(() => {
        spies.Package = {
          inspect: jest.spyOn(Package, 'inspect').mockResolvedValue(inspectResults),
          parseVersionStringToObject: jest.spyOn(Package, 'parseVersionStringToObject').mockReturnValue(exampleVersion),
        };
      });

      it('should return a promise resolving to itself', () => pack.inspect()
        .then((results) => {
          expect(results).toBe(pack);
        }));

      it('should call "Package.inspect()" with the local package name', () => pack.inspect()
        .then(() => {
          expect(spies.Package.inspect).toHaveBeenCalledTimes(1);
          expect(spies.Package.inspect).toHaveBeenCalledWith(expect.objectContaining({
            package: pack.name,
          }));
        }));

      it(
        'should assign the results of "Package.parseVersionStringToObject()" to its version if found',
        () => pack.inspect()
          .then(() => {
            expect(pack.data.version).toBe(exampleVersion);
          }),
      );

      it(
        'should call "Package.parseVersionStringToObject()" with the found tag version if found',
        () => pack.inspect()
          .then(() => {
            expect(spies.Package.parseVersionStringToObject).toHaveBeenCalledTimes(1);
            expect(spies.Package.parseVersionStringToObject)
              .toHaveBeenCalledWith(inspectResults['dist-tags'][exampleTag]);
          }),
      );

      it(
        'should call "Package.parseVersionStringToObject()" with the new tag version if the tag version was not found',
        () => {
          const expectedTag = 'unknown-tag';
          pack.data.version.tag = expectedTag;

          return pack.inspect()
            .then(() => {
              expect(spies.Package.parseVersionStringToObject).toHaveBeenCalledTimes(1);
              expect(spies.Package.parseVersionStringToObject)
                .toHaveBeenCalledWith(`${inspectResults.version}-${expectedTag}.0`);
            });
        },
      );
    });

    describe('setVersion', () => {
      const exampleTag = 'example-replacement-tag';
      const exampleVersion = 1234;
      const versionString = '1.2.3-example-tag.4';
      const versionObject = Package.parseVersionStringToObject(versionString);

      beforeEach(() => {
        pack.data.version = {
          ...versionObject,
        };
      });

      it('should return itself', () => {
        expect(pack.setVersion({})).toBe(pack);
      });

      it('should not update the version if no version was provided', () => {
        pack.setVersion();

        expect(pack.data.version).toEqual(versionObject);
      });

      it('should set the major version when the major version is provided', () => {
        pack.setVersion({ major: exampleVersion });

        expect(pack.data.version.major).toBe(exampleVersion);
      });

      it('should assign the orignal major version when the major version is not a number', () => {
        pack.setVersion({ major: `${exampleVersion}` });

        expect(pack.data.version.major).toBe(versionObject.major);
      });

      it('should assign the orignal major version when the major version is not provided', () => {
        pack.setVersion({ major: undefined });

        expect(pack.data.version.major).toBe(versionObject.major);
      });

      it('should set the minor version when the minor version is provided', () => {
        pack.setVersion({ minor: exampleVersion });

        expect(pack.data.version.minor).toBe(exampleVersion);
      });

      it('should assign the orignal minor version when the minor version is not a number', () => {
        pack.setVersion({ minor: `${exampleVersion}` });

        expect(pack.data.version.minor).toBe(versionObject.minor);
      });

      it('should assign the orignal minor version when the minor version is not provided', () => {
        pack.setVersion({ minor: undefined });

        expect(pack.data.version.minor).toBe(versionObject.minor);
      });

      it('should set the patch version when the patch version is provided', () => {
        pack.setVersion({ patch: exampleVersion });

        expect(pack.data.version.patch).toBe(exampleVersion);
      });

      it('should assign the orignal patch version when the patch version is not a number', () => {
        pack.setVersion({ patch: `${exampleVersion}` });

        expect(pack.data.version.patch).toBe(versionObject.patch);
      });

      it('should assign the orignal patch version when the patch version is not provided', () => {
        pack.setVersion({ patch: undefined });

        expect(pack.data.version.patch).toBe(versionObject.patch);
      });

      it('should set the release version when the release version is provided', () => {
        pack.setVersion({ release: exampleVersion });

        expect(pack.data.version.release).toBe(exampleVersion);
      });

      it('should assign the orignal release version when the patch version is not a number', () => {
        pack.setVersion({ release: `${exampleVersion}` });

        expect(pack.data.version.release).toBe(versionObject.release);
      });

      it('should assign the orignal release version when the patch version is not provided', () => {
        pack.setVersion({ release: undefined });

        expect(pack.data.version.release).toBe(versionObject.release);
      });

      it('should set the tag when the tag is provided', () => {
        pack.setVersion({ tag: exampleTag });

        expect(pack.data.version.tag).toBe(exampleTag);
      });

      it('should set the tag to the original tag when the tag is not provided', () => {
        pack.setVersion({ tag: undefined });

        expect(pack.data.version.tag).toBe(versionObject.tag);
      });
    });

    describe('syncVersion()', () => {
      const spies = {};
      let version;
      let stableVersion;

      beforeEach(() => {
        version = {
          major: 1,
          minor: 2,
          patch: 3,
          release: 4,
          tag: pack.version.tag,
        };

        stableVersion = {
          major: 4,
          minor: 5,
          patch: 6,
          release: 0,
          tag: Package.CONSTANTS.STABLE_TAG,
        };

        spies.Package = {
          parseVersionStringToObject: jest.spyOn(Package, 'parseVersionStringToObject').mockReturnValue(stableVersion),
        };
      });

      it('should return itself if the current Package tag is stable', () => {
        version.tag = Package.CONSTANTS.STABLE_TAG;

        pack.setVersion(version);

        const results = pack.syncVersion();

        expect(results).toBe(pack);
        expect(spies.Package.parseVersionStringToObject).toHaveBeenCalledTimes(0);
      });

      it('should call "Package.parseVersionStringToObject()" with the latest version tag info', () => {
        pack.syncVersion();

        expect(spies.Package.parseVersionStringToObject).toHaveBeenCalledTimes(1);
        expect(spies.Package.parseVersionStringToObject)
          .toHaveBeenCalledWith(pack.data.packageInfo['dist-tags'].latest);
      });

      it('should update the major version if it is different', () => {
        pack.setVersion(version);
        pack.syncVersion();

        expect(pack.data.version.major).toBe(stableVersion.major);
      });

      it('should update the minor version if it is different', () => {
        pack.setVersion(version);
        pack.syncVersion();

        expect(pack.data.version.minor).toBe(stableVersion.minor);
      });

      it('should update the patch version if it is different', () => {
        pack.setVersion(version);
        pack.syncVersion();

        expect(pack.data.version.patch).toBe(stableVersion.patch);
      });

      it('should reset the release version if the major semantic version value has changed', () => {
        pack.setVersion({ ...stableVersion, major: 123, tag: version.tag });
        pack.syncVersion();

        expect(pack.data.version.release).toBe(0);
      });

      it('should reset the release version if the minor semantic version value has changed', () => {
        pack.setVersion({ ...stableVersion, minor: 123, tag: version.tag });
        pack.syncVersion();

        expect(pack.data.version.release).toBe(0);
      });

      it('should reset the release version if the patch semantic version value has changed', () => {
        pack.setVersion({ ...stableVersion, patch: 123, tag: version.tag });
        pack.syncVersion();

        expect(pack.data.version.release).toBe(0);
      });

      it('should not reset the release version if the semantic version value has not changed', () => {
        const release = 123;

        pack.setVersion({ ...stableVersion, release, tag: version.tag });
        pack.syncVersion();

        expect(pack.data.version.release).toBe(release);
      });
    });
  });

  describe('static', () => {
    describe('CONSTANTS', () => {
      it('should return all keys from constants', () => {
        expect(Object.keys(Package.CONSTANTS)).toEqual([
          'DEFAULT_VERSION',
          'PACKAGE_DEFINITION_FILE',
          'STABLE_TAG',
        ]);
      });
    });

    describe('inspect()', () => {
      const packageName = 'example-package';
      const viewResults = {
        version: '4.5.6',
        'dist-tags': {
          'example-tag': '1.2.3-example-tag.4',
          [Package.CONSTANTS.STABLE_TAG]: '4.5.6',
        },
      };

      const spies = {};

      beforeEach(() => {
        spies.yarn = {
          view: jest.spyOn(Yarn, 'view').mockResolvedValue(viewResults),
        };
      });

      it('should call "Yarn.view()" with the appropriate options', () => Package.inspect({ package: packageName })
        .then(() => {
          expect(spies.yarn.view).toHaveBeenCalledTimes(1);
          expect(spies.yarn.view).toHaveBeenCalledWith({
            distTags: true,
            package: packageName,
            version: true,
          });
        }));

      it('should return the resolve of "Yarn.view()', () => Package.inspect({ package: packageName })
        .then((results) => {
          expect(results).toBe(viewResults);
        }));

      it('should return a "PackageInfo" Object when "Yarn.view()" rejects', () => {
        spies.yarn.view.mockRejectedValue(new Error());

        return Package.inspect({ package: packageName })
          .then((results) => {
            expect(results).toEqual({
              version: Package.CONSTANTS.DEFAULT_VERSION,
              'dist-tags': {
                [Package.CONSTANTS.STABLE_TAG]: Package.CONSTANTS.DEFAULT_VERSION,
              },
            });
          });
      });
    });

    describe('parseVersionStringToObject()', () => {
      const exampleVersionObject = {
        major: 1,
        minor: 2,
        patch: 3,
        release: 4,
        tag: 'example-tag',
      };
      const exampleVersionString = Package.parseVersionObjectToString(exampleVersionObject);

      it('should return a major value when the provided major value is a number', () => {
        expect(Package.parseVersionStringToObject(exampleVersionString).major)
          .toBe(exampleVersionObject.major);
      });

      it('should return "0" value when the provided major value is not a number', () => {
        const mutatedVersionString = Package.parseVersionObjectToString({ ...exampleVersionObject, major: 'nan' });

        expect(Package.parseVersionStringToObject(mutatedVersionString).major).toBe(0);
      });

      it('should return a minor value when the provided minor value is a number', () => {
        expect(Package.parseVersionStringToObject(exampleVersionString).minor)
          .toBe(exampleVersionObject.minor);
      });

      it('should return "0" value when the provided minor value is not a number', () => {
        const mutatedVersionString = Package.parseVersionObjectToString({ ...exampleVersionObject, minor: 'nan' });

        expect(Package.parseVersionStringToObject(mutatedVersionString).minor).toBe(0);
      });

      it('should return a patch value when the provided patch value is a number', () => {
        expect(Package.parseVersionStringToObject(exampleVersionString).patch)
          .toBe(exampleVersionObject.patch);
      });

      it('should return "0" value when the provided patch value is not a number', () => {
        const mutatedVersionString = Package.parseVersionObjectToString({ ...exampleVersionObject, patch: 'nan' });

        expect(Package.parseVersionStringToObject(mutatedVersionString).patch).toBe(0);
      });

      it('should return a release value when the provided release value is a number', () => {
        expect(Package.parseVersionStringToObject(exampleVersionString).release)
          .toBe(exampleVersionObject.release);
      });

      it('should return "0" value when the provided release value is not a number', () => {
        const mutatedVersionString = Package.parseVersionObjectToString({ ...exampleVersionObject, release: 'nan' });

        expect(Package.parseVersionStringToObject(mutatedVersionString).release).toBe(0);
      });

      it('should return a tag value when a version with a tag is provided', () => {
        expect(Package.parseVersionStringToObject(exampleVersionString).tag)
          .toBe(exampleVersionObject.tag);
      });

      it(`should return "${Package.CONSTANTS.STABLE_TAG}" value when the provided value does not include a tag`, () => {
        const mutatedVersionString = Package.parseVersionObjectToString({
          ...exampleVersionObject,
          tag: undefined,
        });

        expect(Package.parseVersionStringToObject(mutatedVersionString).tag)
          .toBe(Package.CONSTANTS.STABLE_TAG);
      });

      it(`should return "${Package.CONSTANTS.STABLE_TAG}" value when the provided tag has a length of "0"`, () => {
        const mutatedVersionString = Package.parseVersionObjectToString({
          ...exampleVersionObject,
          tag: '',
        });

        expect(Package.parseVersionStringToObject(mutatedVersionString).tag)
          .toBe(Package.CONSTANTS.STABLE_TAG);
      });
    });

    describe('parseVersionObjectToString()', () => {
      const exampleVersionString = '1.2.3-example-tag.4';
      const exampleVersionObject = Package.parseVersionStringToObject(exampleVersionString);

      it('should return the provided major, minor, patch, and release values', () => {
        const parsed = Package.parseVersionObjectToString(exampleVersionObject);
        const [semanticVersion, ...tagDetails] = parsed.split('-');
        const [major, minor, patch] = semanticVersion.split('.');
        const release = tagDetails.join('-').split('.').pop();

        expect(major).toBe(`${exampleVersionObject.major}`);
        expect(minor).toBe(`${exampleVersionObject.minor}`);
        expect(patch).toBe(`${exampleVersionObject.patch}`);
        expect(release).toBe(`${exampleVersionObject.release}`);
      });

      it('should return the provided tag when it exists', () => {
        const parsed = Package.parseVersionObjectToString(exampleVersionObject);
        const split = parsed.split('-');
        split.shift();

        const [tag] = split.join('-').split('.');

        expect(tag).toBe(exampleVersionObject.tag);
      });

      it('should return no tag or release when the tag does not exist', () => {
        const mutated = { ...exampleVersionObject, tag: undefined };
        const parsed = Package.parseVersionObjectToString(mutated);
        const expected = exampleVersionString.split('-').shift();

        expect(parsed).toBe(expected);
      });
    });

    describe('readDefinition()', () => {
      const definition = {};
      const definitionPath = 'example-definition-path';
      const spies = {};

      beforeEach(() => {
        spies.fs = {
          readFile: jest.spyOn(fs, 'readFile').mockResolvedValue(
            Buffer.from(JSON.stringify(definition), 'utf8'),
          ),
        };
      });

      it('should return a promise resolving in the found definition', () => Package.readDefinition({ definitionPath })
        .then((results) => {
          expect(results).toEqual(definition);
        }));

      it(
        'should attempt to read the file at the provided definition path',
        () => Package.readDefinition({ definitionPath })
          .then(() => {
            expect(spies.fs.readFile).toHaveBeenCalledTimes(1);
            expect(spies.fs.readFile).toHaveBeenCalledWith(definitionPath);
          }),
      );
    });
  });
});
