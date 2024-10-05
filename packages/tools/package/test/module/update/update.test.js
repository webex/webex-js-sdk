const fs = require('fs/promises');
const path = require('path');

const { Package, update } = require('@webex/package-tools');

describe('update', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(update.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "packages" option', () => {
      const found = update.config.options.find((option) => option.name === 'packages');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string...');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "tag" option', () => {
      const found = update.config.options.find((option) => option.name === 'tag');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });
  });

  describe('handler', () => {
    const rootDir = '/path/to/project';
    const spies = {};
    const packages = ['example-package-a', '@scope/example-package-b', 'invalid-package-f'];
    const tag = 'example-tag';
    const options = { tag, packages };

    const inspectedVersion = '1.1.1';
    const inspectedTagVersion = `100.50.0-${tag}.1000`;

    const inspectResolve = {
      version: inspectedVersion,
      'dist-tags': {
        latest: inspectedVersion,
        [tag]: inspectedTagVersion,
      },
    };

    const readDefinitionResolve = {
      name: 'example-name',
      dependencies: {
        [packages[0]]: '1.2.3',
      },
      devDependencies: {
        [packages[1]]: '4.5.6',
      },
      peerDependencies: {
        'unknown-package-c': '7.8.9',
      },
      bundleDependencies: {
        'unknown-package-d': '10.11.12',
      },
      optionalDependencies: {
        'unknown-package-e': '13.14.15',
      },
    };

    beforeEach(() => {
      spies.fs = {
        writeFile: jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined),
      };

      spies.Package = {
        inspect: jest.spyOn(Package, 'inspect').mockResolvedValue(inspectResolve),
        readDefinition: jest.spyOn(Package, 'readDefinition').mockResolvedValue(readDefinitionResolve),
      };

      spies.path = {
        join: jest.spyOn(path, 'join'),
      };

      spies.process = {
        cwd: jest.spyOn(process, 'cwd').mockReturnValue(rootDir),
        stdout: {
          write: jest.spyOn(process.stdout, 'write').mockReturnValue(undefined),
        },
      };
    });

    it('should attempt to read the definition file at the definition path', () => update.handler(options).then(() => {
      const expected = {
        definitionPath: path.join(rootDir, Package.CONSTANTS.PACKAGE_DEFINITION_FILE),
      };

      expect(spies.Package.readDefinition).toHaveBeenCalledTimes(1);
      expect(spies.Package.readDefinition).toHaveBeenCalledWith(expected);
    }));

    it('should attempt to inspect all valid packages', () => update.handler(options).then(() => {
      const validPackages = ['example-package-a', '@scope/example-package-b'];

      validPackages.forEach((pack) => {
        expect(spies.Package.inspect).toHaveBeenCalledWith({ package: pack });
      });

      expect(spies.Package.inspect).toHaveBeenCalledTimes(validPackages.length);
    }));

    it('should attempt to write the file to the target destination correctly', () => {
      const definitionPath = path.join(rootDir, Package.CONSTANTS.PACKAGE_DEFINITION_FILE);

      return update.handler(options)
        .then(() => {
          expect(spies.fs.writeFile).toHaveBeenCalledWith(definitionPath, expect.any(String), { encoding: 'utf-8' });
        });
    });

    it('should attempt to write output to terminal', () => update.handler(options).then(() => {
      expect(spies.process.stdout.write).toHaveBeenCalledWith(expect.any(String));
    }));

    it('should use the latest tag with no tag is provided', () => {
      const customizedOptions = { ...options, tag: undefined };

      return update.handler(customizedOptions).then(() => {
        expect(spies.fs.writeFile.mock.calls[0][1].includes(`"${packages[0]}": "${inspectedVersion}"`)).toBeTruthy();
        expect(spies.fs.writeFile.mock.calls[0][1].includes(`"${packages[1]}": "${inspectedVersion}"`)).toBeTruthy();
      });
    });

    it('should not make any changes when provided with no packages', () => {
      const customOptions = { ...options, packages: undefined };

      return update.handler(customOptions).then(() => {
        expect(spies.Package.inspect).toHaveBeenCalledTimes(0);
      });
    });

    it('should not throw in the case that a definition dependency group is not defined', () => {
      spies.Package.readDefinition.mockResolvedValue({});

      return expect(() => update.handler(options)).not.toThrow(expect.any(Error));
    });

    it('should not update a dependency who does not have a version for the provided tag', () => {
      const customOptions = { ...options, tag: 'invalid' };

      return update.handler(customOptions).then(() => {
        expect(
          spies.fs.writeFile.mock.calls[0][1]
            .includes(`"${packages[0]}": "${readDefinitionResolve.dependencies[packages[0]]}"`),
        ).toBeTruthy();

        expect(
          spies.fs.writeFile.mock.calls[0][1]
            .includes(`"${packages[1]}": "${readDefinitionResolve.dependencies[packages[0]]}"`),
        ).toBeTruthy();
      });
    });
  });
});
