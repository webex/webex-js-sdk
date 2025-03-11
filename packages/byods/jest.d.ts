import 'jest';

declare global {
  namespace jest {
    /* eslint-disable-next-line no-unused-vars */
    interface Matchers<R> {
      toBeCalledOnceWith(received?: any, ...expected: any[]): CustomMatcherResult;
    }
  }
}
