/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {readFile} from 'fs';
import {join} from 'path';

import {fromFile} from 'file-type';
import {isBuffer} from '@webex/common';

export const fetchWithoutMagic = (filename) =>
  new Promise((resolve, reject) => {
    const filepath = join(__dirname, '../../../@webex/test-helper-server/static', filename);

    readFile(filepath, (err, data) => {
      if (err) {
        reject(err);

        return;
      }
      resolve({...data, name: filename});
    });
  });

export const fetch = (filename) =>
  fetchWithoutMagic(filename)
    .then((data) => Promise.all([fromFile(data), data]))
    // .then(([{mime: type}, data]) => {
    //   console.error(data, type);

    //   return {...data, type};
    // });
    .then(([{mime: type}, data]) =>
      type ? {...data, type} : Promise.reject(new Error('Invalid Media Type'))
    );

export const isBufferLike = (file) => isBuffer(file);

export const isBlobLike = (file) => isBuffer(file);

export const isMatchingFile = (left, right) => {
  if (!isBufferLike(left)) {
    throw new Error('`left` must be a `Buffer`');
  }

  if (!isBufferLike(right)) {
    throw new Error('`right` must be a `Buffer`');
  }

  // Node 10 doesn't have Buffer#equals()
  if (left.equals) {
    return Promise.resolve(left.equals(right));
  }

  if (left.length !== right.length) {
    return Promise.resolve(false);
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return Promise.resolve(false);
    }
  }

  return Promise.resolve(true);
};
