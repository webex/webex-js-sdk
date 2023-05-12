export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeCalledOnceWith(received?: any, ...expected: any[]): CustomMatcherResult;
    }
  }
}