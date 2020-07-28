const glob = require('glob');
const webexPackagesPath = glob.sync(`packages/node_modules/@webex/**/*/package.json`)
const webexPackages = webexPackagesPath.map(file => ({
  filename: file,
  type: 'json'
}))

module.exports = {
  releaseCommitMessageFormat: 'chore(release): v{{currentTag}} [skip ci]',
  packageFiles: [
    'package.json',
    'package-lock.json',
    'packages/node_modules/webex/package.json',
    ...webexPackagesPath,
  ],
  bumpFiles: [
    {
      filename: 'package.json',
      type: 'json'
    },
    {
      filename: 'package-lock.json',
      type: 'json'
    },
    {
      filename: 'packages/node_modules/webex/package.json',
      type: 'json'
    },
    ...webexPackages
  ]
}
