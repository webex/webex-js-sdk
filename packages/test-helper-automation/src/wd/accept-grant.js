/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var wd = require('wd');

wd.addPromiseChainMethod('acceptGrant', function acceptGrant() {
  var selector = 'input[value="Accept"]';
  return this
    .hasElementByCssSelector(selector)
      .then(function hasElement(has) {
        if (has) {
          return this
            .waitForElementByCssSelector(selector)
              .click();
        }
        return this;
      }.bind(this));
});
