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

import {
  escape,
  isFunction,
  isObject,
  isString,
  pick
} from 'lodash';

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

const changeRE = /^change:/;

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

    this.on(`all`, (name) => {
      if (changeRE.test(name)) {
        this.trigger(`change`, this);
      }
    });
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

  @computed({
    deps: `id`,
    fn() {
      return this.getId() === null;
    }
  })
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
    const attrOptions = Object.assign({props: true}, options);
    const res = this.getAttributes(attrOptions, true);
    Reflect.ownKeys(this, (key) => {
      if (isFunction(this[key].serialize)) {
        res[key] = this[key].serialize();
      }
    });
    return res;
  }

  set(key, value) {
    if (isObject(key)) {
      Object.assign(this, key);
      return;
    }
    this[key] = value;
  }

  get(key) {
    return this[key];
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

  getAttributes(options) {
    options = Object.assign({
      session: false,
      props: false,
      derived: false
    }, options || {});

    const keys = [];

    // reminder: getters/setters are on the prototype, so only for in loops will
    // pick up most properties
    for (const key in this) {
      // not a fan of continue, but the booleans get really unreadable without
      // them
      /* eslint no-continue: [0] */

      if (isFunction(this[key])) {
        continue;
      }

      let descriptor = Reflect.getOwnPropertyDescriptor(this, key);
      if (!descriptor) {
        descriptor = Reflect.getOwnPropertyDescriptor(Reflect.getPrototypeOf(this), key);
      }

      if (options.props && descriptor.enumerable) {
        keys.push(key);
        continue;
      }

      if (options.session && !descriptor.enumerable) {
        keys.push(key);
        continue;
      }

      if (options.derived && descriptor.derived) {
        keys.push(key);
        continue;
      }
    }

    return pick(this, keys);
  }
  // // TODO _events should be made nonenumerable by @evented
  // @nonenumerable
  // _events

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

  @readonly
  isState = true

  static extend(protoProps) {
    // Most of this function is a manual implementation of the babel decorators
    // legacy transform.
    // eslint-disable-next-line consistent-this
    const Base = this;
    protoProps = protoProps || {};

    const props = {};

    // breaking: constructor can't be overridden
    class Child extends Base {
      constructor(attrs, options) {
        super(attrs, options);

        Object.keys(props).forEach((property) => {
          const descriptor = props[property];
          if (!descriptor) {
            return;
          }

          const current = this[property];

          const desc = Object.assign({}, descriptor);
          if (descriptor.initializer) {
            desc.value = Reflect.apply(descriptor.initializer, this, []);
          }

          Reflect.defineProperty(this, property, desc);
        });

        // So, this is kinda redundant - the base constructor has already
        // assigned values once - but so far, it's the only way I've found to
        // keep the initial values
        // TODO pause events (but compute derived values)
        Object.assign(this, attrs);
        // TODO resume events
      }
    }

    if (protoProps.derived) {
      Object.keys(protoProps.derived).forEach((property) => {
        const propDef = protoProps.derived[property];
        const desc = {};
        computed(propDef)(Child, property, desc);
        props[property] = desc;
      });
    }
    if (protoProps.session) {
      Object.keys(protoProps.session).forEach((property) => {
        const propDef = protoProps.session[property];
        const desc = prepare(propDef, property);
        nonenumerable(Child, property, desc);
        props[property] = desc;
      });
    }
    if (protoProps.props) {
      Object.keys(protoProps.props).forEach((property) => {
        const propDef = protoProps.props[property];
        const desc = prepare(propDef, property);
        props[property] = desc;
      });
    }
    if (protoProps.children) {
      Object.keys(protoProps.children).forEach((property) => {
        const propDef = protoProps.children[property];
        const desc = {};
        child(propDef)(Child, property, desc);
        props[property] = desc;
      });
    }

    const proto = Object.keys(protoProps).reduce((p, key) => {
      if (isFunction(protoProps[key])) {
        p[key] = protoProps[key];
      }

      return p;
    }, {});
    Object.assign(Child.prototype, proto);

    function prepare(propDef, prop) {
      /* eslint complexity: [0] */
      const desc = {};
      if (isString(propDef)) {
        type(propDef)(Child, prop, desc);
      }
      //
      // // Reminder: default must come first
      // if (propDef.default) {
      //   propDef.initializer = propDef.default;
      // }
      // if (propDef.type) {
      //   type(propDef.type)(Child, prop, desc);
      // }
      // if (propDef.required) {
      //   required(Child, prop, desc);
      // }
      // if (propDef.allowNull === false) {
      //   noNull(Child, prop, desc);
      // }
      // if (propDef.setOnce) {
      //   setOnce(Child, prop, desc);
      // }
      // if (propDef.values) {
      //   values(propDef.values)(Child, prop, desc);
      // }
      // if (propDef.test) {
      //   test(propDef.test)(Child, prop, desc);
      // }
      //
      return desc;
    }

    return Child;

    // TODO dataTypes
    // TODO collections
  }
}
