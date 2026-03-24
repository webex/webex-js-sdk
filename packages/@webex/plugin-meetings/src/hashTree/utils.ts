/* eslint-disable import/prefer-default-export */

import {ObjectType, HashTreeObject} from './types';

/**
 * Checks if the given hash tree object is of type "self"
 * @param {HashTreeObject} object object to check
 * @returns {boolean} True if the object is of type "self", false otherwise
 */
export function isSelf(object: HashTreeObject) {
  return object.htMeta.elementId.type.toLowerCase() === ObjectType.self;
}

/**
 * Checks if the given hash tree object is of type "Metadata"
 * @param {HashTreeObject} object object to check
 * @returns {boolean} True if the object is of type "Metadata", false otherwise
 */
export function isMetadata(object: HashTreeObject) {
  return object.htMeta.elementId.type.toLowerCase() === ObjectType.metadata;
}

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
