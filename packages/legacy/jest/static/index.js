module.exports = {
  clearMocks: true,
  rootDir: './',
  testEnvironment: 'jsdom',
  collectCoverage: false,
  coverageReporters: ['text'],
  coverageProvider: 'v8',
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {rootMode: 'upward'}],
  },
  reporters: ['default'],
  testMatch: ['<rootDir>/test/unit/**/!(lib|fixture)/*.[jt]s'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
