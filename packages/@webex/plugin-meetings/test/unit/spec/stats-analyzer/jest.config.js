module.exports = {
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
};
