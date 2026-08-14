export type AISummaryError = Error & {data?: Record<string, unknown>};

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const createAISummaryError = (errorCode: string): AISummaryError => {
  const error = new Error(errorCode) as AISummaryError;

  error.data = {errorCode};

  return error;
};
