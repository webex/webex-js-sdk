/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

'use strict';

var applyTemplates = require('../../lib/apply-templates');
var S = require('string');
var yeoman = require('yeoman-generator');

module.exports = yeoman.Base.extend({
  constructor: function constructor() {
    yeoman.Base.apply(this, arguments);

    this.argument('packagename', {
      type: String,
      required: true
    });

    if (this.packagename.indexOf('plugin') !== 0) {
      throw new Error('plugins must begin with "plugin-"');
    }
  },

  initializing: function initializing() {
    this.composeWith('ciscospark:package', {
      args: this.args,
      options: Object.assign({}, this.options, {
        templateDestsToSkip: ['src/index.js']
      })
    });
  },

  configuring: function configuring() {
    var pluginFileBaseName = this.pluginFileBaseName = this.packagename.split('-').slice(1).join('-');
    this.pluginName = S(pluginFileBaseName).camelize().s;
    this.constructorName = S('_' + pluginFileBaseName).camelize().s;
  },

  _applyTemplates: applyTemplates,

  writing: function writing() {
    this._applyTemplates({
      'src/__plugin__.js': 'src/' + this.pluginFileBaseName + '.js',
      'src/_config.js': 'src/config.js'
      'src/_index.js': 'src/index.js',
      '_README.md': 'README.md'
    });
  }
});
