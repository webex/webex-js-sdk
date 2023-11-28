/**
 * List Command Options inteface.
 *
 * @public
 */
export interface Options {
  /**
   * Package to manage and validate scripts against.
   */
  package: string;

  /**
   * Script to manager or validated on the provided package.
   */
  script: string;
}
