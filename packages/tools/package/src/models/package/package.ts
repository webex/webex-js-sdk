import fs from 'fs/promises';
import path from 'path';

import { Yarn } from '../../utils';

import CONSTANTS from './package.constants';
import type { Config, Data, Version } from './package.types';

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

  /**
   * Apply the modifications of this Package instance to the package definition
   * files.
   *
   * @returns - Promse that resolves to this Package instance.
   */
  public apply(): Promise<this> {
    const packageDefinitionPath = path.join(this.data.location, CONSTANTS.PACKAGE_DEFINITION_FILE);

    return fs.readFile(packageDefinitionPath)
      .then((buffer) => buffer.toString())
      .then((data) => JSON.parse(data))
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
    }

    return this.setVersion(processedVersion);
  }

  /**
   * Inspect the remote data for this Package instance.
   *
   * @remarks
   * This uses the Yarn class to communicate with the target NPM registry for
   * this project in order to collect data for the target Package instance.
   *
   * @returns - Promise resolving with this Package instance.
   */
  public inspect(): Promise<this> {
    return Yarn.view({ package: this.data.name, distTags: true })
      .then((tags) => {
        const version = tags[this.data.version.tag]
          || `${tags[CONSTANTS.STABLE_TAG] || '0.0.0'}-${this.data.version.tag}.0`;

        this.data.version = Package.parseVersionStringToObject(version);

        return this;
      });
  }

  /**
   * Constants associated with the Package class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
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
}

export default Package;
