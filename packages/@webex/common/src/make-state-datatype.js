/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

// Reminder: any class using this function must have something like the
// following in its initialize method:
//
// // HACK to deal with the fact that AmpersandState#dataTypes#set is a pure
// // function.
// this._dataTypes = cloneDeep(this._dataTypes);
// Object.keys(this._dataTypes).forEach((key) => {
//   if (this._dataTypes[key].set) {
//     this._dataTypes[key].set = this._dataTypes[key].set.bind(this);
//   }
// });
// // END HACK

/**
 * Creates an ampersand state object that wires its event handlers like a an
 * ampersand child
 * @param {Function} Constructor
 * @param {string} name
 * @returns {Object}
 */
export default function makeStateDataType(Constructor, name) {
  if (!Constructor || !name) {
    throw new Error('missing parameter for makeStateDataType');
  }

  return {
    dataType: {
      set: function set(newVal) {
        // newVal.parent = this;
        if (newVal instanceof Constructor) {
          newVal.parent = this;

          return {
            val: newVal,
            type: name,
          };
        }

        // We only want to construct the new instance if we have some set of
        // attributes (even an empty object) to base it on. This is to deal with
        // the unexpected side effect that AmpState#unset will create a new
        // instance.
        return {
          val: newVal ? new Constructor(newVal, {parent: this}) : undefined,
          type: name,
        };
      },
      compare: function compare(currentValue, newVal) {
        return currentValue === newVal;
      },
      onChange: function onChange(newVal, previousVal, attributeName) {
        // Copied from ampersand-state.js
        // if this has changed we want to also handle
        // event propagation
        if (previousVal) {
          this.stopListening(
            previousVal,
            'all',
            this._getCachedEventBubblingHandler(attributeName)
          );
        }

        if (newVal) {
          this.listenTo(newVal, 'all', this._getCachedEventBubblingHandler(attributeName));
        }
      },
    },
    prop: {
      /**
       * This is a really unfortunate hack to deal with ampersand`s decision to
       * make the dateType#set function pure. The only function called with the
       * scope of the parent at set time seems to be test
       * @param {AmpersandState} newVal
       * @returns {boolean}
       */
      test: function test(newVal) {
        if (!newVal) {
          return false;
        }
        newVal.parent = this;

        return false;
      },
      type: name,
    },
  };
}
