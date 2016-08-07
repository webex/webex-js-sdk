/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {patterns} from '@ciscospark/common';

const usersByEmail = new WeakMap();
const usersById = new WeakMap();

export default class UserStore {
  constructor() {
    usersByEmail.set(this, new Map());
    usersById.set(this, new Map());
  }

  add(user) {
    if (!user.id) {
      return Promise.reject(`\`user.id\` is required`);
    }

    if (!user.emailAddress) {
      return Promise.reject(`\`user.emailAddress\` is required`);
    }

    const p1 = this.getById(user.id)
      .then((u) => usersById.get(this).set(user.id, Object.assign({}, u, user)))
      .catch(() => usersById.get(this).set(user.id, Object.assign({}, user)));

    const p2 = this.getByEmail(user.emailAddress)
      .then((u) => usersByEmail.get(this).set(user.emailAddress, Object.assign({}, u, user)))
      .catch(() => usersByEmail.get(this).set(user.emailAddress, Object.assign({}, user)));

    return Promise.all([p1, p2]);
  }

  get(id) {
    if (patterns.uuid.test(id)) {
      return this.getById(id);
    }

    if (patterns.email.test(id)) {
      return this.getByEmail(id);
    }

    return Promise.reject(`\`id\` does not appear to be a valid user identifier`);
  }

  getById(id) {
    const ret = usersById.get(this).get(id);
    if (ret) {
      return Promise.resolve(ret);
    }
    return Promise.reject(new Error(`No user found identified by specified identifier`));
  }

  getByEmail(email) {
    const ret = usersByEmail.get(this).get(email);
    if (ret) {
      return Promise.resolve(ret);
    }
    return Promise.reject(new Error(`No user found identified by specified identifier`));
  }
}
