/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint require-jsdoc: [0] */
/* eslint no-warning-comments: [0] */

import {
  deprecated,
  nonenumerable,
  nonconfigurable,
  readonly
} from 'core-decorators';

import {
  escape,
  isArray,
  isFunction,
  isObject,
  isString,
  pick
} from 'lodash';

import arrayNext from 'array-next';

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

import {
  getType
} from './decorators/type';

import {
  getAllowedValues
} from './decorators/values';

import {
  finishChanging,
  getChangedAttributes,
  getPreviousAttributes,
  hasChanged,
  isChanging,
  isPending,
  silence,
  startChanging,
  unsilence
} from './decorators/prop';

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

    // TODO this should be done by @evented
    Reflect.defineProperty(this, `_events`, Object.assign(Reflect.getOwnPropertyDescriptor(this, `_events`), {
      enumerable: false
    }));
  }

  // config attributes
  @nonconfigurable
  @nonenumerable
  @readonly
  extraProperties = `ignore`

  @nonconfigurable
  @nonenumerable
  @readonly
  idAttribute = `id`

  @nonconfigurable
  @nonenumerable
  @readonly
  namespaceAttribute = `namespace`

  @nonconfigurable
  @nonenumerable
  @readonly
  typeAttribute = `modelType`

  initialize() {
    // intentionally empty; here to be overridden
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

  @deprecated(`isValid()'s implementation in AmpState feels a little rough; this method may be removed in the near future'`)
  isValid(options) {
    return this._validate({}, Object.assign(options || {}, {validate: true}));
  }

  _validate(attrs, options) {
    if (!options.validate || !this.validate) {
      return true;
    }

    attrs = Object.assign({}, this, attrs);
    const error = this.validationError = this.validate(attrs, options) || null;
    if (!error) {
      return true;
    }
    this.trigger(`invalid`, this, error, Object.assign(options || {}, {validationError: error}));
    return false;
  }

  // eslint-disable-next-line no-unused-vars
  parse(resp, options) {
    return resp;
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

  set(key, value, options) {
    let attrs;
    if (isObject(key) || key === null) {
      attrs = key;
      options = value;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    options = options || {};

    if (!this._validate(attrs, options)) {
      return false;
    }

    const {
      unset,
      silent
    } = options;

    if (silent) {
      silence(this);
    }
    // startChanging(this);
    Object.assign(this, key);
    // finishChanging(this);

    if (silent) {
      unsilence(this);
    }

    return this;
  }

  get(key) {
    return this[key];
  }

  toggle(property) {
    if (getType(Reflect.getPrototypeOf(this), property) === `boolean`) {
      this[property] = !this[property];
    }
    else if (getAllowedValues(Reflect.getPrototypeOf(this), property)) {
      this[property] = arrayNext(getAllowedValues(Reflect.getPrototypeOf(this), property), this[property]);
    }
    else {
      throw new TypeError(`Can only toggle properties that are type \`boolean\` or have \`values\` array.`);
    }
    return this;
  }

  previousAttributes() {
    return Object.assign({}, getPreviousAttributes(this));
  }

  hasChanged(attr) {
    return hasChanged(this, attr);
  }

  changedAttributes(diff) {
    return getChangedAttributes(this, diff);
  }

  toJSON() {
    return this.serialize();
  }

  unset(attrs, options) {
    options = options || {};

    attrs = isArray(attrs) ? attrs : [attrs];
    // AmpState uses delete, but that won't fire change events given the current
    // implementation here.
    attrs.forEach((key) => {
      this[key] = undefined;
    });
  }

  clear(options) {
    for (const key in this) {
      if (!isFunction(this[key]) && Reflect.getOwnPropertyDescriptor(this, key).writable !== false) {
        this.unset(key, options);
      }
    }
  }

  previous(attr) {
    return getPreviousAttributes(this, attr);
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

  @nonenumerable
  @readonly
  isState = true

  /**
   * AmpersandState compatibility properties
   */

  get _changing() {
    return isChanging(this);
  }

  get _previousAttributes() {
    return getPreviousAttributes(this);
  }

  get _changed() {
    const changed = getChangedAttributes(this);
    const attrs = {};
    if (changed) {
      for (const key of changed) {
        attrs[key] = changed.get(key);
      }
    }
    return attrs;
  }

  get _pending() {
    return isPending(this);
  }

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

      if (isArray(propDef)) {
        if (propDef[0]) {
          type(propDef[0])(Child, prop, desc);
        }
        if (propDef[1]) {
          required(propDef[1])(Child, prop, desc);
        }
        if (propDef[2]) {
          propDef.initializer = () => propDef[2];
        }
      }

      // Reminder: default must come first to ensure other decorators interact
      // with its initializer correctly
      if (propDef.default) {
        propDef.initializer = () => propDef.default;
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

    return Child;

    // TODO dataTypes
    // TODO collections
  }
}
