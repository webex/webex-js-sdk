require('@webex/env-config-legacy');

/**
 * Check HTTPS before starting the meeting browser tests.
 * @param {Object} env environment settings, including KARMA_HTTPS
 * @returns {undefined}
 */
const checkKarmaHttps = (env = process.env) => {
  if (env.KARMA_HTTPS !== 'true') {
    throw new Error(
      [
        'Meeting browser tests require HTTPS at https://localhost.webex.com.',
        '',
        'From the repository root, run the one-time machine setup:',
        '  yarn setup:karma-https',
        '',
        'Then add KARMA_HTTPS=true to the repository root .env file,',
        'or enable HTTPS for a single run:',
        '  KARMA_HTTPS=true yarn workspace @webex/plugin-meetings test:browser',
        '',
        'Keep any --targets or --karma-browsers options you were using.',
      ].join('\n')
    );
  }
};

if (require.main === module) {
  try {
    checkKarmaHttps();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = checkKarmaHttps;
