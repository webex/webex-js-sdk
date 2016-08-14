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

import {escape, isFunction, isString} from 'lodash';

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
    // TODO set cid

    if (options.parse) {
      attrs = this.parse(attrs, options);
    }
    // TODO set parent
    // TODO set collection
    Object.assign(this, attrs);
    if (options.init !== false) {
      Reflect.apply(this.initialize, this, [attrs, options]);
    }
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
  // TODO _events should be made nonenumerable by @evented
  @nonenumerable
  _events

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

  static extend(protoProps) {
    const Base = this;
    // breaking: constructor can't be overridden
    class Child extends Base {}
    protoProps = protoProps || {};
    const proto = Object.keys(protoProps).reduce((p, key) => {
      if (isFunction(protoProps[key])) {
        p[key] = protoProps[key];
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
    if (protoProps.session) {
      props = Object.keys(protoProps.session).reduce((p, prop) => {
        const propDef = protoProps.session[prop];
        p[prop] = prepare(propDef, prop);
        nonenumerable(Child, prop, p[prop]);
        return p;
      }, props);
    }
    if (protoProps.props) {
      props = Object.keys(protoProps.props).reduce((p, prop) => {
        const propDef = protoProps.props[prop];
        p[prop] = prepare(propDef, prop);
        return p;
      }, props);
    }
    if (protoProps.derived) {
      props = Object.keys(protoProps.derived).reduce((p, prop) => {
        const propDef = protoProps.derived[prop];
        p[prop] = computed(propDef);
        return p;
      }, props);
    }
    if (protoProps.children) {
      props = Object.keys(protoProps.children).reduce((p, prop) => {
        const propDef = protoProps.children[prop];
        p[prop] = child(propDef);
        return p;
      }, props);
    }

    Object.defineProperties(Child.prototype, props);

    return Child;

    // TODO dataTypes
    // TODO collections
  }
}
