/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {SparkHttpError} from '../../..';

describe(`spark-core`, () => {
  describe(`SparkHttpError`, () => {

    it(`falls back to an empty message`, () => {
      const res = {
        statusCode: 400,
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);

      assert.equal(error.rawMessage, ``);
    });

    it(`parses string responses`, () => {
      const message = `an error occurred`;
      const res = {
        statusCode: 400,
        body: message,
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);

      assert.equal(error.rawMessage, message);
    });

    it(`parses JSON responses`, () => {
      const message = {
        data: `an error`
      };

      const res = {
        statusCode: 400,
        body: message,
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);

      assert.equal(error.rawMessage, JSON.stringify(message, null, 2));
    });

    it(`parses stringified JSON responses`, () => {
      const message = JSON.stringify({
        data: `an error`
      });

      const res = {
        statusCode: 400,
        body: message,
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);

      assert.equal(error.rawMessage, JSON.stringify(JSON.parse(message), null, 2));
    });

    it(`parses JSON responses for candidate error messages`, () => {
      const message = `an error occurred`;
      const res = {
        statusCode: 400,
        body: {
          error: message
        },
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);
      assert.equal(error.rawMessage, message);
    });

    it(`parses JSON responses for candidate error messages recursively`, () => {
      const message = `an error occurred`;
      const res = {
        statusCode: 400,
        body: {
          error: {
            errorString: message
          }
        },
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);
      assert.equal(error.rawMessage, message);
    });

    it(`parses JSON responses for candidate error messages with arrays`, () => {
      const message = `an error occurred`;
      const res = {
        statusCode: 400,
        body: {
          Errors: [
            {
              code: 10001,
              description: message
            }
          ]
        },
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);
      assert.equal(error.rawMessage, message);
    });

    it(`parses JSON responses for candidate error messages with arrays recursively`, () => {
      const message = `an error occurred`;
      const res = {
        statusCode: 400,
        body: {
          error: {
            message: [
              {
                code: 10001,
                description: message
              }
            ]
          }
        },
        options: {
          headers: {},
          service: `service`,
          url: `url`
        }
      };

      const error = new SparkHttpError(res);
      assert.equal(error.rawMessage, message);
    });

  });
});
