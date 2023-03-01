const config = {
  bundledPackages: [],
  compiler: {
    tsconfigFilePath: './tsconfig.json',
  },
  apiReport: {
    enabled: true,
    reportFileName: '<unscopedPackageName>.api.md',
    reportFolder: '<projectFolder>/dist/docs/metadata/',
    reportTempFolder: '<projectFolder>/dist/docs/metadata/',
  },
  docModel: {
    enabled: true,
    apiJsonFilePath: '<projectFolder>/dist/docs/metadata/<unscopedPackageName>.api.json',
  },
  dtsRollup: {
    enabled: true,
  },
  tsdocMetadata: {},
  mainEntryPointFilePath: '<projectFolder>/dist/types/index.d.ts',
  messages: {
    compilerMessageReporting: {
      default: {
        logLevel: 'warning',
      },
    },
    extractorMessageReporting: {
      default: {
        logLevel: 'warning',
      },

      'ae-wrong-input-file-type': {
        logLevel: 'none',
      },
    },
    tsdocMessageReporting: {
      default: {
        logLevel: 'warning',
      },
    },
  },
  projectFolder: '.',
};

module.exports = config;
