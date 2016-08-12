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
  nonenumerable,
  nonconfigurable,
  readonly
} from 'core-decorators';

import {escape, isString} from 'lodash';

import {
  child,
  computed,
  evented,
  type,
  required,
  noNull,
  setOnce,
  values,
  test
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

  // config attributes
  @nonconfigurable
  @readonly
  extraProperties = `ignore`

  @nonconfigurable
  @readonly
  idAttribute = `id`

  @nonconfigurable
  @readonly
  namespaceAttribute = `namespace`

  @nonconfigurable
  @readonly
  typeAttribute = `modelType`

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

  @computed(function isNew() {return this.getId() === null;})
  isNew

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

  static extend(def) {
    // breaking: constructor can't be overridden
    class Child extends State {}
    const proto = Object.keys(def).reduce((p, key) => {
      if (isFunction(def[key])) {
        p[key] = def[key];
      }

      // TODO idAttribute
      // TODO namespaceAttribute
      // TODO typeAttribute
      // TODO extraProperties
      // TODO collection
      // TODO cid

      return p;
    }, {});
    Object.assign(Child.prototype, proto);
    let props = {};

    function prepare(propDef, prop) {
      /* eslint complexity: [0] */
      const desc = {};
      if (isString(propDef)) {
        type(propDef)(Child, prop, desc);
      }

      // Reminder: default must come first
      if (propDef.default) {
        propDef.initializer = propDef.default;
      }
      if (propDef.type) {
        type(propDef.type)(Child, prop, desc);
      }
      if (propDef.required) {
        required(Child, prop, desc);
      }
      if (propDef.allowNull === false) {
        noNull(Child, prop, desc);
      }
      if (propDef.setOnce) {
        setOnce(Child, prop, desc);
      }
      if (propDef.values) {
        values(propDef.values)(Child, prop, desc);
      }
      if (propDef.test) {
        test(propDef.test)(Child, prop, desc);
      }

      return desc;
    }
    if (def.session) {
      props = Object.keys(def.session).reduce((p, prop) => {
        const propDef = def.session[prop];
        p[prop] = prepare(propDef, prop);
        nonenumerable(Child, prop, p[prop]);
        return p;
      }, props);
    }
    if (def.props) {
      props = Object.keys(def.props).reduce((p, prop) => {
        const propDef = def.props[prop];
        p[prop] = prepare(propDef, prop);
        return p;
      }, props);
    }
    if (def.derived) {
      props = Object.keys(def.derived).reduce((p, prop) => {
        const propDef = def.derived[prop];
        p[prop] = computed(propDef);
        return p;
      }, props);
    }
    if (def.children) {
      props = Object.keys(def.children).reduce((p, prop) => {
        const propDef = def.children[prop];
        p[prop] = child(propDef);
        return p;
      }, props);
    }

    // TODO dataTypes
    // TODO collections
  }
}
