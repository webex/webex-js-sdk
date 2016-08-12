/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-empty-function: [0] */
/* eslint no-invalid-this: [0] */
/* eslint require-jsdoc: [0] */

import {
  deprecated,
  nonconfigurable,
  readonly
} from 'core-decorators';

import {escape} from 'lodash';

import {
  computed,
  evented
} from './decorators';

@evented
export default class State {
  constructor(attrs, options) {
    options = options || {};
    if (options.parse) {
      attrs = this.parse(attrs, options);
    }

    // TODO set parent
    // TODO set cid
    // TODO set collection
    // TODO sett attrs
  }
  //
  // // config attributes
  // @nonconfigurable
  // @readonly
  // extraProperties = `ignore`
  //
  // @nonconfigurable
  // @readonly
  // idAttribute = `id`
  //
  // @nonconfigurable
  // @readonly
  // namespaceAttribute = `namespace`
  //
  // @nonconfigurable
  // @readonly
  // typeAttribute = `modelType`

  initialize() {

  }

  getId() {
    return this[this.idAttribute];
  }

  getNamespace() {
    return this[this.namespaceAttribute];
  }

  getType() {
    return this[this.typeAttribute];
  }

  // @computed(function isNew() {return this.getId() === null;})
  // isNew

  @deprecated(`Consider investing on a more complete escaping function than lodash.escape`)
  escape(attr) {
    return escape(this[attr]);
  }

  isValid(options) {

  }

  parse(resp, options) {

  }

  serialize(options) {

  }

  set() {

  }

  get() {

  }

  toggle(property) {

  }

  previousAttributes() {

  }

  hasChanged(attr) {

  }

  changedAttributes(diff) {

  }

  toJSON() {
    return this.serialize();
  }

  unset() {

  }

  clear() {

  }

  previous() {

  }

  getAttributes() {

  }

  get attributes() {
    return this.getAttributes({
      props: true,
      session: true
    });
  }

  get all() {
    return this.getAttributes({
      session: true,
      props: true,
      derived: true
    });
  }

  get isState() {
    return true;
  }

  static extend() {

  }
}
