const glob = require('glob');

module.exports = {
  releaseCommitMessageFormat: 'chore(release): v{{currentTag}} [skip ci]',
  bumpFiles: [
    ...glob
      .sync(`packages/node_modules/@webex/**/*/package.json`)
      .map(file => ({
        filename: file,
        type: 'json'
      })),
    {
      filename: 'package.json',
      type: 'json'
    },
    {
      filename: 'packages/node_modules/webex/package.json',
      type: 'json'
    }
  ]
}
