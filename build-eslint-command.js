const shelljs = require(`shelljs`);

const JENKINS = process.env.JENKINS;

const flags = JENKINS ? `-f checkstyle -o reports/style/eslint.xml` : ``;

const command = `node ${__dirname}/node_modules/eslint/bin/eslint.js --ignore-pattern "packages/node_modules/generator-ciscospark/generators/*/templates/**" --ignore-path .gitignore --fix ${flags} ${__dirname}`;

shelljs.exec(command);
