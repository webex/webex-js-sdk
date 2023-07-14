import fs from 'fs/promises';
import path from 'path';

import { Yarn } from '../../utils';

import CONSTANTS from './package.constants';
import type {
  Config,
  Data,
  Definition,
  InspectOptions,
  PackageInfo,
  Version,
} from './package.types';

/**
 * The Package class.
 *
 * @remarks
 * The Package class is used for the management and modification of a package
 * within a mono repository using Yarn Workspaces.
 *
 * @example
 * ```js
 * const { Package } = require('@webex/package-tools');
 *
 * const package = new Package(config);
 * ```
 *
 * @public
 */
class Package {
  /**
   * Protected storage for this Package instance.
   */
  protected data: Data;

  /**
   * Construct a new Package instance.
   *
   * @param config - Configuration object.
   */
  public constructor(config: Config) {
    this.data = {
      location: config.location,
      name: config.name,
      packageInfo: {
        version: Package.CONSTANTS.DEFAULT_VERSION,
        'dist-tags': {
          [Package.CONSTANTS.STABLE_TAG]: Package.CONSTANTS.DEFAULT_VERSION,
        },
      },
      version: {
        major: 0,
        minor: 0,
        patch: 0,
        release: 0,
        tag: config.tag || CONSTANTS.STABLE_TAG,
      },
    };
  }

  /**
   * The name of this package.
   */
  public get name(): string {
    return this.data.name;
  }

  public get version(): string {
    return Package.parseVersionObjectToString(this.data.version);
  }

  /**
   * Apply the modifications of this Package instance to the package definition
   * files.
   *
   * @returns - Promse that resolves to this Package instance.
   */
  public apply(): Promise<this> {
    const packageDefinitionPath = path.join(this.data.location, CONSTANTS.PACKAGE_DEFINITION_FILE);

    return Package.readDefinition({ definitionPath: packageDefinitionPath })
      .then((definition) => ({
        ...definition,
        version: Package.parseVersionObjectToString(this.data.version),
      }))
      .then((definition) => {
        const data = `${JSON.stringify(definition, null, 2)}\n`;

        return fs.writeFile(packageDefinitionPath, data);
      })
      .then(() => this);
  }

  /**
   * Determine if a provided script exists within this Package.
   *
   * @param scriptName - Name of the script to validate this Package has.
   * @returns - Promise resolving to whether or not the script exists.
   */
  public hasScript(scriptName: string): Promise<boolean> {
    const packageDefinitionPath = path.join(this.data.location, CONSTANTS.PACKAGE_DEFINITION_FILE);

    return Package.readDefinition({ definitionPath: packageDefinitionPath })
      .then((definition) => {
        if (!definition.scripts || !definition.scripts[scriptName]) {
          return false;
        }

        return true;
      });
  }

  /**
   * Increment the version of this Package instance with the provided Version
   * Object.
   *
   * @remarks
   * Incrementing takes the most-significant version provided in this methods
   * Version object and applies its value. Other, less-significant versions are
   * set to `0` during application.
   *
   * @param version - Partial Version Object to increment this Package instance with.
   * @returns - This Package instance.
   */
  public incrementVersion(version: Partial<Version> = {}): this {
    const processedVersion: Version = { ...this.data.version };

    if (version.major) {
      processedVersion.major += version.major;
      processedVersion.minor = 0;
      processedVersion.patch = 0;
      processedVersion.release = 0;
    } else if (version.minor) {
      processedVersion.minor += version.minor;
      processedVersion.patch = 0;
      processedVersion.release = 0;
    } else if (version.patch) {
      processedVersion.patch += version.patch;
      processedVersion.release = 0;
    } else if (version.release) {
      processedVersion.release += version.release;
    } else if (processedVersion.tag !== CONSTANTS.STABLE_TAG) {
      processedVersion.release += 1;
    } else {
      processedVersion.patch += 1;
    }

    return this.setVersion(processedVersion);
  }

  /**
   * Inspect the registry data for this Package instance.
   *
   * @remarks
   * This uses the Yarn class to communicate with the target NPM registry for
   * this project in order to collect data for the target Package instance.
   *
   * @returns - Promise resolving with this Package instance.
   */
  public inspect(): Promise<this> {
    const { tag } = this.data.version;

    return Package.inspect({ package: this.data.name })
      .then((packageInfo) => {
        this.data.packageInfo = packageInfo;

        const tagVersion = packageInfo['dist-tags'][tag];

        if (tagVersion) {
          this.data.version = Package.parseVersionStringToObject(tagVersion);

          return this;
        }

        this.data.version = Package.parseVersionStringToObject(`${packageInfo.version}-${tag}.0`);

        return this;
      });
  }

  /**
   * Set the version of this Package instance.
   *
   * @param version - Version Object to update this Package instance with.
   * @returns - This Package instance.
   */
  public setVersion(version: Partial<Version> = {}): this {
    this.data.version = {
      major: Number.isInteger(version.major) ? version.major as number : this.data.version.major,
      minor: Number.isInteger(version.minor) ? version.minor as number : this.data.version.minor,
      patch: Number.isInteger(version.patch) ? version.patch as number : this.data.version.patch,
      release: Number.isInteger(version.release) ? version.release as number : this.data.version.release,
      tag: version.tag || this.data.version.tag,
    };

    return this;
  }

  /**
   * Synchronize this package tag with the current stable package tag version.
   *
   * @remarks
   * This method will skip any modifications if the current version tag is
   * stable.
   *
   * @returns - This Package instance.
   */
  public syncVersion(): this {
    const { version } = this.data;

    if (version.tag === Package.CONSTANTS.STABLE_TAG) {
      return this;
    }

    const stable = Package.parseVersionStringToObject(this.data.packageInfo['dist-tags'].latest);

    let hasVersionChanged = false;

    if (version.major !== stable.major) {
      version.major = stable.major;
      hasVersionChanged = true;
    }

    if (version.minor !== stable.minor) {
      version.minor = stable.minor;
      hasVersionChanged = true;
    }

    if (version.patch !== stable.patch) {
      version.patch = stable.patch;
      hasVersionChanged = true;
    }

    if (hasVersionChanged) {
      version.release = 0;
    }

    return this;
  }

  /**
   * Constants associated with the Package class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }

  /**
   * Inspect the registry data for the provided package name.
   *
   * @param options - Inspect Options.
   * @returns - Package Info for the provided package.
   */
  public static inspect(options: InspectOptions): Promise<PackageInfo> {
    return Yarn.view({ distTags: true, package: options.package, version: true })
      .catch(() => ({
        version: Package.CONSTANTS.DEFAULT_VERSION,
        'dist-tags': {
          [Package.CONSTANTS.STABLE_TAG]: Package.CONSTANTS.DEFAULT_VERSION,
        },
      }));
  }

  /**
   * Parse a provided version string as a Version Object.
   *
   * @example
   * ```js
   * const versionString = '1.2.3-beta-branch.50`;
   * const versionObject = Package.parseVersionStringToObject(versionString);
   * // { major: 1, minor: 2, patch: 3, tag: 'beta-branch', release: 50 }
   * ```
   *
   * @param version - Package definition version string.
   * @returns - Version Object reflecting the provided version string.
   */
  public static parseVersionStringToObject(version: string): Version {
    const [semanticVersion, ...tagDetails] = version.split('-');
    const [major, minor, patch] = semanticVersion.split('.');
    const [tag, release] = tagDetails.join('-').split('.');

    const parsedMajor = parseInt(major, 10);
    const parsedMinor = parseInt(minor, 10);
    const parsedPatch = parseInt(patch, 10);
    const parsedRelease = parseInt(release, 10);

    return {
      major: parsedMajor && Number.isInteger(parsedMajor) ? parsedMajor : 0,
      minor: parsedMinor && Number.isInteger(parsedMinor) ? parsedMinor : 0,
      patch: parsedPatch && Number.isInteger(parsedPatch) ? parsedPatch : 0,
      release: parsedRelease && Number.isInteger(parsedRelease) ? parsedRelease : 0,
      tag: tag && tag.length > 0 ? tag : CONSTANTS.STABLE_TAG,
    };
  }

  /**
   * Parse a provided Version Object as a version string.
   *
   * @example
   * ```js
   * const versionObject =  { major: 1, minor: 2, patch: 3, tag: 'beta-branch', release: 50 };
   * const versionString = Package.parseVersionObjectToString(versionObject);
   * // '1.2.3-beta-branch.50`;
   * ```
   *
   * @param version - Package definition Version Object.
   * @returns - Version string reflecting the provided Version Object.
   */
  public static parseVersionObjectToString(version: Version): string {
    const semanticVersion = `${version.major}.${version.minor}.${version.patch}`;

    return [
      semanticVersion,
      version.tag && version.tag !== CONSTANTS.STABLE_TAG ? `-${version.tag}.${version.release}` : '',
    ].join('');
  }

  /**
   * Read a definition file using the provided options.
   *
   * @example
   * ```js
   * Package.readDefinition({ definitionPath })
   *   .then((definition) => console.log(definition));
   * ```
   *
   * @param options - Options to use when reading a file definition.
   * @returns - Promise resolving to the package definition.
   */
  public static readDefinition({ definitionPath }: { definitionPath: string }): Promise<Definition> {
    return fs.readFile(definitionPath)
      .then((buffer) => buffer.toString())
      .then((data) => JSON.parse(data))
      .then((definition: Definition) => definition);
  }
}

export default Package;
