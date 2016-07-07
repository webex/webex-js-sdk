/*
 * modified from grunt-documentation to add support for inlining of test
 * https://github.com/documentationjs/grunt-documentation
 *
 * Copyright (c) 2015 André Fiedler
 * Licensed under the MIT license.
 */

// Disable eslint because this file is directly copied from the
// grunt-documentation project; it's a temporary measure, so matching the
// original style will simplify updates when needed.
/* eslint-disable */

'use strict';

function stripIgnore(content) {
  var startPattern = /\/\*\s*START_EXAMPLE_IGNORE\s*\*\//;
  var endPattern = /\/\*\s*END_EXAMPLE_IGNORE\s*\*\//;

  var start, end, remove;
  while ((start = content.search(startPattern)) !== -1) {
    end = content.indexOf('*/', content.search(endPattern)) + 2;
    if (!end) {
      throw new Error('encountered unclosed ignore block');
    }

    remove = content.slice(start, end);
    content = content.replace(remove, '');
  }
  return content;
}

function fixImport(content) {
  var pattern = /(?:\.\.\/)+(?:\.\.)/;
  return content.replace(pattern, 'ciscospark');
}

module.exports = function(grunt) {

    var path = require('path'),
        chalk = require('chalk'),
        documentation = require('documentation').build || require('documentation'),
        formats = require('documentation').formats;

    grunt.registerMultiTask('documentation', 'Use Grunt with documentation to generate great documentation for your JavaScript projects.', function() {
        var options = this.options({
            format: 'html',
            shallow: false,
            github: false,
            access: ['public', 'protected', 'undefined'],
            order: []
        });

        var formatter = formats[options.format];
        if (!formatter) {
            throw new Error('invalid format given: valid options are ' + Object.keys(formats).join(', '));
        }

        var docOptions = {
            github: options.github,
            shallow: options.shallow,
            access: options.access,
            order: options.order
        };

        var formatterOptions = {
          github: options.github,
          theme: options.theme
        };

        var externals = {};

        if (options.externals) {
          externals = grunt.task.normalizeMultiTaskFiles(options.externals, this.target);

          externals = externals.reduce(function(externals, external) {
            var key = external.dest.replace('.js', '').replace(/\//g, '__').replace(/\./g, '_');
            externals[key] = fixImport(stripIgnore(grunt.file.read(external.src[0])));
            return externals;
          }, {});
        }

        var done = this.async(),
            waiting = 0;

        function wait (c) {
            c = c || 1;
            waiting += c;
        }

        function release() {
            waiting--;
            if (waiting <= 0) {
                done();
                grunt.log.writeln(chalk.green('Done, created documentation at ') + path.join(process.cwd(), options.destination));
            }
        }

        function generateDocs(files) {
            wait ();
            documentation(files, docOptions, function(err, comments) {
                if (err) {
                    grunt.log.error(err.toString());
                    if (err.codeFrame) {
                        grunt.log.error(err.codeFrame);
                    }
                    done(false);
                } else {
                    wait ();
                    formatter(comments, formatterOptions, function(err, output) {
                        if (err) {
                            grunt.log.error(err.toString());
                            if (err.codeFrame) {
                                grunt.log.error(err.codeFrame);
                            }
                            done(false);
                        } else {
                            if (options.format === 'json' || options.format === 'md') {
                                var dest = path.join(process.cwd(), options.destination, (options.filename || 'API.' + options.format));
                                grunt.file.write(dest, grunt.template.process(output, {data: externals}));
                                grunt.log.writeln('File ' + chalk.cyan(options.filename || 'API.' + options.format) + ' created.');
                            } else if (options.format === 'html') {
                                wait (output.length);
                                output.forEach(function(file) {
                                    var dest = path.join(process.cwd(), options.destination, file.relative);
                                    if (file.isDirectory() || grunt.file.isDir(file.path)) {
                                        grunt.file.mkdir(dest);
                                        grunt.verbose.writeln('Directory ' + chalk.cyan(file.relative) + ' created.');
                                    } else {
                                        var out;
                                        if (file.relative.indexOf('html') !== -1) {
                                          out = file.contents.toString()
                                            .replace(/&lt;/g, '<')
                                            .replace(/&gt;/g, '>');
                                          out = grunt.template.process(out, {data: externals});
                                        }
                                        else {
                                          out = file.contents;
                                        }
                                        grunt.file.write(dest, out);
                                        grunt.verbose.writeln('File ' + chalk.cyan(file.relative) + ' created.');
                                    }
                                    release();
                                });
                            }
                        }
                        release();
                    });
                }
                release();
            });
        }

        var files = [];

        var filesToProcess = this.files.length;

        this.files.forEach(function(f) {
            var src = f.src.filter(function(filepath) {
                // Warn on and remove invalid source files (if nonull was set).
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else {
                    return true;
                }
            });
            files = files.concat(src);
            filesToProcess--;
            if (filesToProcess <= 0) {
                generateDocs(files);
            }
        }.bind(this));
    });

};
