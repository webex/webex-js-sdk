import wrapper from './jest.wrapper';

/**
 * Jest test runner utility methods.
 *
 * @public
 */
class Jest {
  /**
   * Run Jest tests against the provided files.
   *
   * @param options - Options object.
   * @returns - Empty Promise.
   */
  public static test({ files }: { files: Array<string> }): Promise<void> {
    return Jest.wrapper.run(files);
  }

  public static get wrapper() {
    return wrapper;
  }
}

export default Jest;
