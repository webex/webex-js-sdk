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
          readDefinition: spyOn(Package, 'readDefinition').and.resolveTo(definition),
        };

        spies.fs = {
          writeFile: spyOn(fs, 'writeFile').and.resolveTo(undefined),
        };

        spies.path = {
          join: spyOn(path, 'join').and.returnValue(examplePath),
        };
      });

      it('should return a promise that resolves to itself', () => pack.apply()
        .then((results) => {
          expect(results).toBe(pack);
        }));

      it('should attempt to ammend the package definition file to the package path', () => pack.apply()
        .then(() => {
          expect(spies.path.join).toHaveBeenCalledOnceWith(
            pack.data.location,
            Package.CONSTANTS.PACKAGE_DEFINITION_FILE,
          );
        }));

      it('should attempt to read the file at the package definition location', () => pack.apply()
        .then(() => {
          expect(spies.Package.readDefinition).toHaveBeenCalledOnceWith({
            definitionPath: examplePath,
          });
        }));

      it('should attempt to write the local version to the file at the definition location', () => {
        const data = `${JSON.stringify(definition, null, 2)}\n`;

        return pack.apply()
          .then(() => {
            expect(spies.fs.writeFile).toHaveBeenCalledOnceWith(examplePath, data);
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
          readDefinition: spyOn(Package, 'readDefinition').and.resolveTo(definition),
        };

        spies.path = {
          join: spyOn(path, 'join').and.returnValue(examplePath),
        };
      });

      it('should return a promise that resolves to a boolean', () => pack.hasScript(exampleScript)
        .then((results) => {
          expect(typeof results).toBe('boolean');
        }));

      it('should attempt to ammend the package definition file to the package path', () => pack.hasScript(exampleScript)
        .then(() => {
          expect(spies.path.join).toHaveBeenCalledOnceWith(
            pack.data.location,
            Package.CONSTANTS.PACKAGE_DEFINITION_FILE,
          );
        }));

      it('should attempt to read the file at the package definition location', () => pack.hasScript(examplePath)
        .then(() => {
          expect(spies.Package.readDefinition).toHaveBeenCalledOnceWith({
            definitionPath: examplePath,
          });
        }));

      it('should return false if the definition has no scripts', () => {
        spies.Package.readDefinition.and.resolveTo({});

        return pack.hasScript(exampleScript)
          .then((results) => {
            expect(results).toBe(false);
          });
      });

      it('should return false if the definition does not have the provided script', () => pack.hasScript('another-example-script')
        .then((results) => {
          expect(results).toBe(false);
        }));

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
          setVersion: spyOn(pack, 'setVersion').and.returnValue(pack),
        };
      });

      it('should not increment the version if the provided version does not exist', () => {
        pack.incrementVersion();

        expect(spies.pack.setVersion)
          .toHaveBeenCalledOnceWith(jasmine.objectContaining({ ...versionObject }));
      });

      it('should increment only the major version if the major version is provided', () => {
        pack.incrementVersion({ major: exampleVersion });

        expect(spies.pack.setVersion)
          .toHaveBeenCalledOnceWith(
            jasmine.objectContaining({
              major: exampleVersion + versionObject.major,
              minor: 0,
              patch: 0,
              release: 0,
              tag: versionObject.tag,
            }),
          );
      });

      it('should increment only the minor version and preserve the major version if the minor version is provided', () => {
        pack.incrementVersion({ minor: exampleVersion });

        expect(spies.pack.setVersion)
          .toHaveBeenCalledOnceWith(
            jasmine.objectContaining({
              major: versionObject.major,
              minor: exampleVersion + versionObject.minor,
              patch: 0,
              release: 0,
              tag: versionObject.tag,
            }),
          );
      });

      it('should increment only the patch version and preserve the major and minor versions if the minor version is provided', () => {
        pack.incrementVersion({ patch: exampleVersion });

        expect(spies.pack.setVersion)
          .toHaveBeenCalledOnceWith(
            jasmine.objectContaining({
              major: versionObject.major,
              minor: versionObject.minor,
              patch: exampleVersion + versionObject.patch,
              release: 0,
              tag: versionObject.tag,
            }),
          );
      });

      it('should increment only the release version and preserve the major, minor, and patch versions if the minor version is provided', () => {
        pack.incrementVersion({ release: exampleVersion });

        expect(spies.pack.setVersion)
          .toHaveBeenCalledOnceWith(
            jasmine.objectContaining({
              major: versionObject.major,
              minor: versionObject.minor,
              patch: versionObject.patch,
              release: exampleVersion + versionObject.release,
              tag: versionObject.tag,
            }),
          );
      });
    });

    describe('inspect()', () => {
      const exampleVersion = 'example-version';
      const viewResults = {
        'example-tag': '1.2.3-example-tag.4',
        [Package.CONSTANTS.STABLE_TAG]: '4.5.6',
      };

      const spies = {};

      beforeEach(() => {
        spies.yarn = {
          view: spyOn(Yarn, 'view').and.resolveTo(viewResults),
        };

        spies.Package = {
          parseVersionStringToObject: spyOn(Package, 'parseVersionStringToObject').and.returnValue(exampleVersion),
        };
      });

      it('should return a promise resolving to itself', () => pack.inspect()
        .then((results) => {
          expect(results).toBe(pack);
        }));

      it('should call "Yarn.view()" with the local package name with dist tags enabled', () => pack.inspect()
        .then(() => {
          expect(spies.yarn.view).toHaveBeenCalledOnceWith(jasmine.objectContaining({
            package: pack.name,
            distTags: true,
          }));
        }));

      it('should assign the results of "Package.parseVersionStringToObject()" to its version', () => pack.inspect()
        .then(() => {
          expect(pack.data.version).toBe(exampleVersion);
        }));

      it('should call "Package.parseVersionStringToObject()" with the found tag version if found', () => pack.inspect()
        .then(() => {
          expect(spies.Package.parseVersionStringToObject).toHaveBeenCalledOnceWith(viewResults['example-tag']);
        }));

      it('should call "Package.parseVersionStringToObject()" with the new tag version if the provided tag version was not found', () => {
        const expectedTag = 'unknown-tag';
        pack.data.version.tag = expectedTag;

        return pack.inspect()
          .then(() => {
            expect(spies.Package.parseVersionStringToObject)
              .toHaveBeenCalledOnceWith(`${viewResults[Package.CONSTANTS.STABLE_TAG]}-${expectedTag}.0`);
          });
      });

      it('should call "package.parseVersionStringToObject()" with a new version when no stable tag is avaiblle', () => {
        const expectedTag = 'unknown-tag';
        pack.data.version.tag = expectedTag;

        spies.yarn.view.and.resolveTo({});

        return pack.inspect()
          .then(() => {
            expect(spies.Package.parseVersionStringToObject)
              .toHaveBeenCalledOnceWith(`0.0.0-${expectedTag}.0`);
          });
      });
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
  });

  describe('static', () => {
    describe('CONSTANTS', () => {
      it('should return all keys from constants', () => {
        expect(Object.keys(Package.CONSTANTS)).toEqual([
          'PACKAGE_DEFINITION_FILE',
          'STABLE_TAG',
        ]);
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
          readFile: spyOn(fs, 'readFile').and.resolveTo(
            Buffer.from(JSON.stringify(definition), 'utf8'),
          ),
        };
      });

      it('should return a promise resolving in the found definition', () => Package.readDefinition({ definitionPath })
        .then((results) => {
          expect(results).toEqual(definition);
        }));

      it('should attempt to read the file at the provided definition path', () => Package.readDefinition({ definitionPath })
        .then(() => {
          expect(spies.fs.readFile).toHaveBeenCalledOnceWith(definitionPath);
        }));
    });
  });
});
