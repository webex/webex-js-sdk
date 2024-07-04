/**
 * Changelog Command Options interface.
 *
 * @public
 */
export interface Options {
  /**
   * Packages updated as part of the version update.
   *
   * @remarks
   * If no packages are defined, this will collect all workspace packages.
   */
  packages: Array<string>;

  /**
   * Tag to update the changelog for.
   */
  tag: string;

  /**
   * Previous commit id
   */
  commit: string;
}
interface CommitDetails {
  /**
   * Details about the commits added as part of the version.
   */
  [key: string]: string;
}

export interface AlongWithData {
  /**
   * Details about the packages that are changed as part of the version.
   */
  [packageName: string]: string;
}

export interface ChangelogEntry {
  [packageName: string]: {
    [version: string]: {
      commits: CommitDetails;
      alongWith: AlongWithData;
    };
  };
}
