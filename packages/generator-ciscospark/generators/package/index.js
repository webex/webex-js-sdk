/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

'use strict';

var applyTemplates = require('../../lib/apply-templates');
var chalk = require('chalk');
var yeoman = require('yeoman-generator');
var yosay = require('yosay');

module.exports = yeoman.Base.extend({
  constructor: function constructor() {
    yeoman.Base.apply(this, arguments);

    this.argument('packagename', {
      type: String,
      required: true
    });
  },

  prompting: function prompting() {
    var done = this.async();

    // Have Yeoman greet the user.
    this.log(yosay(
      'Welcome to the ' + chalk.red('generator-ciscospark') + ' generator!'
    ));

    this.prompt([{
      type: 'input',
      name: 'authorName',
      message: 'What is your name?',
      store: true
    }, {
      type: 'input',
      name: 'authorEmail',
      message: 'What\'s your email address?',
      store: true
    }], function storeAnswers(answers) {
      this.log(answers);
      this.props = answers;
      done();
    }.bind(this));
  },

  _applyTemplates: applyTemplates,

  writing: function writing() {
    this._applyTemplates({
      'doteslintrc.yml': '.eslintrc.yml',
      'src/_index.js': 'src/index.js',
      'test/doteslintrc.yml': 'test/.eslintrc.yml',
      'test/_index.js': 'test/index.js',
      '_package.json': 'package.json',
      '_README.md': 'README.md'
    });
  },

  install: function install() {
    if (!this.options.skipInstall) {
      this.spawnCommand('npm', ['run', 'bootstrap']);
    }
  }
});
