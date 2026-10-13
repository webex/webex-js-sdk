export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export const createDeferred = <T>(): Deferred<T> => {
  let resolveDeferred: (value: T) => void = () => undefined;
  let rejectDeferred: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred,
  };
};

export const createAISummaryError = (errorCode: string) => {
  const error = new Error(errorCode) as Error & {data?: Record<string, unknown>};

  error.data = {errorCode};

  return error;
};

export const createAISummaryErrorExpectation = (errorCode: string) => ({
  message: errorCode,
  data: {errorCode},
});

export const flushEventLoopTurn = () => new Promise((resolve) => setImmediate(resolve));

export const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
