/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

'use strict';

var debug = require('./debug');

module.exports = function applyTemplates(templates) {
  var skips = this.options.templateDestsToSkip || [];
  Object.keys(templates).forEach(function applyTpl(srcPath) {
    if (skips.indexOf(templates[srcPath]) !== -1) {
      return;
    }

    var tplPath = this.templatePath(srcPath);
    var destPath = this.destinationPath('packages/' + this.packagename + '/' + templates[srcPath]);
    debug('writing file at ' + tplPath + ' to ' + destPath);

    this.fs.copyTpl(tplPath, destPath, this);
  }.bind(this));
};
