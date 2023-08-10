export interface Options {
  /**
   * Packages to synchronize
   *
   * @remarks
   * If no packages are defined, this will collect all workspace packages.
   */
  packages?: Array<string>;

  /**
   * Tag to synchronize the version on.
   */
  tag: string;

}

export type ViewResult = {
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
};
