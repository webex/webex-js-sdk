/* eslint-disable import/prefer-default-export */

/**
 * Analyzes given part of Locus DTO recursively and delete any nested objects that have their own htMeta
 *
 * @param {Object} currentLocusPart part of locus DTO to analyze
 * @param {Object} parent parent object
 * @param {string|number} currentKey key of the parent object that currentLocusPart is
 * @returns {void}
 */
export const deleteNestedObjectsWithHtMeta = (
  currentLocusPart: any,
  parent?: any,
  currentKey?: string | number
) => {
  if (typeof currentLocusPart !== 'object' || currentLocusPart === null) {
    return;
  }

  if (parent && currentKey !== undefined && currentLocusPart.htMeta) {
    if (Array.isArray(parent)) {
      parent.splice(Number(currentKey), 1);
    } else {
      delete parent[currentKey];
    }

    return;
  }

  if (Array.isArray(currentLocusPart)) {
    // iterate array in reverse, so that indexes remain valid when deleting elements
    for (let i = currentLocusPart.length - 1; i >= 0; i -= 1) {
      deleteNestedObjectsWithHtMeta(currentLocusPart[i], currentLocusPart, i);
    }
  } else {
    for (const key of Object.keys(currentLocusPart)) {
      if (Object.prototype.hasOwnProperty.call(currentLocusPart, key)) {
        deleteNestedObjectsWithHtMeta(currentLocusPart[key], currentLocusPart, key);
      }
    }
  }
};
