/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

// Reminder: babel-polyfill can't go here because babel puts it after the
// exports
export {default as default, init} from './ciscospark';
export {default as config} from './config';
