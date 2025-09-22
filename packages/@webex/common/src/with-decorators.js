/**
 * Inline decorator helper - applies decorators to a function in order
 * @param {Array} decorators - Array of decorator functions
 * @param {Function} fn - The function to decorate
 * @returns {Function} - The decorated function
 */
export default function withDecorators(decorators, fn) {
  // Create a mock descriptor object for ES2015-style decorators
  let descriptor = {
    value: fn,
    writable: true,
    enumerable: false,
    configurable: true,
  };

  // Apply each decorator in order
  for (const decorator of decorators) {
    // Some decorators check the decorated function name
    // so we have to pass it through here
    const result = decorator({}, fn.name, descriptor);

    // Update the descriptor if the decorator returned one
    if (result && typeof result === 'object' && result.value) {
      descriptor = result;
    }
  }

  return descriptor.value;
}
