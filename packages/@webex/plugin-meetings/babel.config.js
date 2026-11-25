const babelConfigLegacy = require('@webex/babel-config-legacy');

const [presetEnv, ...otherPresets] = babelConfigLegacy.presets;
const [presetEnvName, presetEnvOptions] = presetEnv;

module.exports = {
  ...babelConfigLegacy,
  overrides: [
    {
      // Keep the WASM loader's dynamic import() native instead of compiling it to require(), so
      // the runtime-served emscripten loader is fetched by the browser rather than bundled.
      test: /src[\\/]common[\\/]wasm-loader\.ts$/,
      presets: [
        [presetEnvName, {...presetEnvOptions, exclude: ['transform-dynamic-import']}],
        ...otherPresets,
      ],
    },
  ],
};
