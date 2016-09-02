/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {isArray} from 'lodash';
import {oneFlight, patterns, tap} from '@ciscospark/common';
import {SparkPlugin} from '@ciscospark/spark-core';
import UserUUIDBatcher from './user-uuid-batcher';
import UserUUIDStore from './user-uuid-store';

const User = SparkPlugin.extend({
  namespace: `User`,

  children: {
    batcher: UserUUIDBatcher
  },

  session: {
    store: {
      default() {
        return new UserUUIDStore();
      },
      type: `any`
    }
  },

  asUUID(user, options) {
    if (!user) {
      return Promise.reject(new Error(`\`user\` is required`));
    }

    if (isArray(user)) {
      return Promise.all(user.map((u) => this.asUUID(u, options)));
    }

    const id = this._extractUUID(user);
    if (!(options && options.force) && patterns.uuid.test(id)) {
      return Promise.resolve(id);
    }

    const email = this._extractEmailAddress(user);

    if (!patterns.email.test(email)) {
      return Promise.reject(new Error(`Provided user object does not appear to identify a user`));
    }

    return this.getUUID(email, options);
  },

  fetchUUID(email, options) {
    return this.batcher.request({
      email,
      create: options && options.create
    })
      .then((user) => this.recordUUID(Object.assign({emailAddress: email}, user))
        .then(() => user.id));
  },

  get() {
    return this.request({
      service: `conversation`,
      resource: `users`
    })
      .then((res) => res.body)
      .then(tap((user) => this.recordUUID(user)));
  },

  @oneFlight((email, options) => email + String(options.create))
  getUUID(email, options) {
    return this.store.getByEmail(email)
      .then((user) => {
        if (options && options.create && !user.userExists) {
          return Promise.reject(new Error(`User for specified email cannot be confirmed to exist`));
        }

        if (!user.id) {
          return Promise.reject(new Error(`No id recorded for specified user`));
        }

        return user.id;
      })
      .catch(() => this.fetchUUID(email, options));
  },

  recordUUID(user) {
    if (!user) {
      return Promise.reject(new Error(`\`user\` is required`));
    }

    if (!user.id) {
      return Promise.reject(new Error(`\`user.id\` is required`));
    }

    if (!patterns.uuid.test(user.id)) {
      return Promise.reject(new Error(`\`user.id\` must be a uuid`));
    }

    if (!user.emailAddress) {
      return Promise.reject(new Error(`\`user.emailAddress\` is required`));
    }

    if (!patterns.email.test(user.emailAddress)) {
      return Promise.reject(new Error(`\`user.emailAddress\` must be an email address`));
    }

    return this.store.add(user);
  },

  update(options) {
    if (!options.displayName) {
      return Promise.reject(new Error(`\`options.displayName\` is required`));
    }

    return this.request({
      method: `PATCH`,
      service: `conversation`,
      resource: `users/user`,
      body: options
    })
      .then((res) => res.body);
  },

  _extractUUID: function _extractUUID(user) {
    return user.entryUUID || user.id || user;
  },

  _extractEmailAddress: function _extractEmailAddress(user) {
    return user.email || user.emailAddress || user.entryEmail || user;
  }
});

export default User;
