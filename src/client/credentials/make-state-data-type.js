/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

// Reminder: any class using this function must have something like the
// following in its initialize method:
//
// // HACK to deal with the fact that AmpersandState#dataTypes#set is a pure
// // function.
// this._dataTypes = cloneDeep(this._dataTypes);
// Object.keys(this._dataTypes).forEach(function bindSetter(key) {
//   var dataType = this._dataTypes[key];
//   if (dataType.set) {
//     dataType.set = dataType.set.bind(this);
//   }
// }.bind(this));


module.exports = function makeStateDataType(Constructor, name) {
  if (arguments.length < 2) {
    throw new Error('missing parameter for makeStateDataType');
  }

  return {
    dataType: {
      set: function set(newVal) {
        if (!newVal) {
          return {
            val: undefined,
            type: name
          };
        }
        // newVal.parent = this;
        if (newVal instanceof Constructor) {
          newVal.parent = this;
          return {
            val: newVal,
            type: name
          };
        }

        return {
          val: new Constructor(newVal, {parent: this}),
          // val: new Constructor(newVal),
          type: name
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
          this.stopListening(previousVal, 'all', this._getCachedEventBubblingHandler(attributeName));
        }

        if (newVal) {
          this.listenTo(newVal, 'all', this._getCachedEventBubblingHandler(attributeName));
        }
      }
    },
    prop: {
      /**
       * This is a really unfortunate hack to deal with ampersand's decision to
       * make the dateType#set function pure. The only function called with the
       * scope of the parent at set time seems to be test
       * @param {AmpersandState} newVal
       * @returns {boolean}
       */
      test: function test(newVal) {
        if (newVal) {
          newVal.parent = this;
        }
        return false;
      },
      type: name
    }
  };
};
