const {readFileSync} = require('fs');
const {join} = require('path');

const declarationFiles = [
  'index.d.ts',
  'cc.d.ts',
  'types.d.ts',
  'services/index.d.ts',
  'services/agent/index.d.ts',
  'services/agent/types.d.ts',
  'services/config/types.d.ts',
];

const internalStateControlSymbols = [
  'setAgentChannelState',
  'stateChangeV2',
  'StateChangeV2',
  'AgentChannelState',
  'AgentChannelRelogin',
  'AGENT_CHANNEL_',
  'INTERNAL_AGENT_STATE_CONTROL_EVENTS',
];

const declarationRoot = join(__dirname, '..', 'dist', 'types');
const leaks = declarationFiles.flatMap((file) => {
  const contents = readFileSync(join(declarationRoot, file), 'utf8');

  return internalStateControlSymbols
    .filter((symbol) => contents.includes(symbol))
    .map((symbol) => `${file}: ${symbol}`);
});

if (leaks.length > 0) {
  throw new Error(`State Control V2 leaked into public declarations:\n${leaks.join('\n')}`);
}

process.stdout.write('Public declarations exclude State Control V2 APIs.\n');
