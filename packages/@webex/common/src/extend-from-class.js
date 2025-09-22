/**
 * Fetches all properties and methods from an object, including those inherited from its prototype.
 * @param {*} obj
 * @returns {Object}
 */
function getAllPropertiesAndMethods(obj) {
  const result = {};

  // Get own enumerable properties
  Object.entries(obj).forEach(([key, value]) => {
    result[key] = value;
  });

  // Get methods from prototype
  const prototype = Object.getPrototypeOf(obj);
  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== 'constructor' && typeof prototype[name] === 'function'
  );

  methodNames.forEach((methodName) => {
    result[methodName] = prototype[methodName];
  });

  return result;
}

/**
 * Extends an AmpersandState plugin with properties and methods from a given class.
 * @param {*} BasePlugin
 * @param  {Function} Class
 * @returns {Object}
 */
export default function extendFromClass(BasePlugin, Class) {
  const deviceInstance = new Class();

  const devicePropertiesAndMethods = getAllPropertiesAndMethods(deviceInstance);

  return BasePlugin.extend({
    ...devicePropertiesAndMethods,
  });
}
