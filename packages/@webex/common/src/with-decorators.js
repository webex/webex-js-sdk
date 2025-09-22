/**
 * Inline decorator helper - applies decorators to a function in order
 * @param {Array} decorators - Array of decorator functions
 * @param {Function} fn - The function to decorate
 * @returns {Function} - The decorated function
 */
export default function withDecorators(decorators, fn) {
  return decorators.reduce((decorated, decorator) => decorator(decorated), fn);
}
