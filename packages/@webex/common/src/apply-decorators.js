/**
 * This applies decorators to an ampersand state object
 * It wraps the function in the order the decorators are provided
 * This means that when you call the method, the decorators are applied in reverse order
 * @param {*} object - The object to apply the decorators to
 * @param {*} decoratedMethods
 * @returns {undefined}
 */
export function applyDecorators(object, decoratedMethods) {
  Object.entries(decoratedMethods).forEach(([method, decorators]) => {
    object[method] = decorators.reduce(
      (decorated, decorator) => decorator(decorated),
      object[method]
    );
  });
}

export default {
  applyDecorators,
};
