/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

export default function parse(str) {
  try {
    return JSON.parse(str);
  }
  catch (e) {
    return null;
  }
}
