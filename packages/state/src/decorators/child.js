/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import evented from './evented';
import {trigger} from './prop';

/**
 * @param {Function} Constructor
 * @returns {Function}
 */
export default function child(Constructor) {
  return function childDecorator(target, property, descriptor) {
    evented(target);
    descriptor.initializer = function initializer() {
      const c = new Constructor();
      this.listenTo(c, `all`, (name, model, value) => {
        if (name === `change`) {
          trigger(this, `change`, this);
        }
        else if (name.startsWith(`change:`)) {
          trigger(this, `change:${property}.${name.split(`:`)[1]}`, model, value);
        }
      });
      return c;
    };
  };
}
