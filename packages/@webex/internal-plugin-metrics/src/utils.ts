/* eslint-disable import/prefer-default-export */
/**
 * Generates common metadata for errors
 * @param {any} error
 * @returns {object}
 */
export const generateCommonErrorMetadata = (error) => {
  if (error instanceof Error) {
    return JSON.stringify({
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
  }

  return error;
};

export const getDomain = () => {
  return typeof window !== 'undefined' ? window.location.hostname || 'non-browser' : 'non-browser'; // Check what else we could measure
};
