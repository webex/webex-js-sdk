const path = require('path');
const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor');

const defaultConfig = require('./config');

const buildDocs = (config = {}) => {
  const extractorConfig = ExtractorConfig.prepare({
    configObject: {
      ...defaultConfig,
      ...config,
    },
    packageJsonFullPath: path.join(process.cwd(), './package.json'),
  });

  const results = Extractor.invoke(extractorConfig, {
    localBuild: true,
  });

  if (results.succeeded) {
    process.exitCode = 0;
  } else {
    process.exitCode = 1;
  }
};

module.exports = buildDocs;
