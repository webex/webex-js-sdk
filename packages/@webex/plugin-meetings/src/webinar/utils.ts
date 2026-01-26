/**
 * Remove null/undefined/empty string values from an object
 * @param {object} params
 * @returns {object}
 */
export const sanitizeParams = (params: Record<string, any>) => {
  const result: Record<string, any> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== null && value !== undefined && value !== '') {
      result[key] = value;
    }
  });

  return result;
};
