/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var bodyParser = require('body-parser');
var express = require('express');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var reflect = require('./reflect');
var uuid = require('uuid');

/* eslint new-cap: [0] */
var router = express.Router();

// Configure Image processing
// -------------------------

router.use(bodyParser.raw('image/*'));

router.patch('/reflect', reflect);
router.post('/reflect', reflect);
router.put('/reflect', reflect);

var uploadPath = process.env.PACKAGE ? '.tmp/' + process.env.PACKAGE + '/files' : '.tmp/files';
router.post('/upload', function(req, res, next) {
  mkdirp(uploadPath, function(err) {
    if (err) {
      return next(err);
    }

    var id = uuid.v4();
    var storeAt = path.join(uploadPath, id);
    var getFrom = '/files/download/' + id;

    /* eslint max-nested-callbacks: [0] */
    return fs.writeFile(storeAt, req.body, function(err2) {
      if (err2) {
        return next(err2);
      }

      return res
        .status(201)
        .json({
          loc: getFrom
        })
        .end();
    });
  });
});

router.get('/download/:id', function(req, res, next) {
  if (!req.params.id) {
    return next(new Error('id param is required'));
  }

  return fs.readFile(path.join(uploadPath, req.params.id), function(err, data) {
    if (err) {
      return next(err);
    }

    return res.status(200).send(data).end();
  });
});

router.use('/get', express.static(path.join(__dirname, 'static')));

module.exports = router;
