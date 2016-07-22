'use strict';

module.exports = function required(obj, key) {
  if (!(key in obj)) {
    throw new Error(`obj.${key} is required`);
  }
};
