'use strict';
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');

module.exports = yeoman.Base.extend({
  prompting: function prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(
      chalk.red('generator-ciscospark') + ' is not yet implemented. Are you looking for ' + chalk.red('ciscospark:package') + '?'
    ));
  }
});
