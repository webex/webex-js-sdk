const workspacesRoot = require('find-yarn-workspace-root');
const {config} = require('dotenv');

const rootDirectory = workspacesRoot();

config({path: `${rootDirectory}/.env`});
config({path: `${rootDirectory}/.env.default`});
