const javascriptModern = require('./javascript.modern');
const jestModern = require('./jest.modern');
const typescriptModern = require('./typescript.modern');

module.exports = {
  javascript: {
    modern: javascriptModern,
  },
  jest: {
    modern: jestModern,
  },
  typescript: {
    modern: typescriptModern,
  },
};
