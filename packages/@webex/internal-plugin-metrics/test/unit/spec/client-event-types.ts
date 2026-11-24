import {createRequire} from 'module';
import path from 'path';
import {assert} from '@webex/test-helper-chai';

const clientEventFixture = `
import type {
  AuthClientEventOptions,
  CallDiagnosticMetrics,
  ClientEvent,
  NewMetrics,
  SubmitClientEvent,
} from '../dist/types';
import type {
  BuildClientEventFetchRequestOptions,
  DelayedClientEvent,
  FeatureEvent,
} from '../dist/types/metrics.types';

declare const metrics: NewMetrics;
declare const diagnostics: CallDiagnosticMetrics;

const submitClientEvent: SubmitClientEvent = (args) => metrics.submitClientEvent(args);
const buildClientEventFetchRequestOptions: BuildClientEventFetchRequestOptions = (args) =>
  metrics.buildClientEventFetchRequestOptions(args);

const name = 'client.sign-in.start';
const correlationId = '00000000-0000-4000-8000-000000000001';
const legacyOptions = {
  correlationId,
  clientType: 'TEAMS_CLIENT',
  subClientType: 'WEB_APP',
  networkType: 'unknown',
};
const legacyEvent: ClientEvent = {name, options: legacyOptions};

interface ExtendedDelayedEvent extends DelayedClientEvent {
  source: string;
}
const delayedEvent: ExtendedDelayedEvent = {...legacyEvent, source: 'test'};

submitClientEvent({name, options: legacyOptions});
buildClientEventFetchRequestOptions({name, options: legacyOptions});
submitClientEvent(legacyEvent);
submitClientEvent(delayedEvent);
diagnostics.submitClientEvent({name, options: legacyOptions, delaySubmitEvent: true});
diagnostics.buildClientEventFetchRequestOptions({name, options: legacyOptions});
metrics.setDelaySubmitClientEvents({shouldDelay: false, overrides: legacyOptions});
declare const featureName: FeatureEvent['name'];
metrics.submitFeatureEvent({name: featureName, options: legacyOptions});

const authOptions = {
  diagnosticType: 'auth',
  correlationId,
  clientType: 'TEAMS_CLIENT',
  subClientType: 'WEB_APP',
  networkType: 'wifi',
} satisfies AuthClientEventOptions;
const authEvent = {name, options: authOptions} satisfies Parameters<SubmitClientEvent>[0];

submitClientEvent(authEvent);
buildClientEventFetchRequestOptions(authEvent);
diagnostics.submitClientEvent({...authEvent, delaySubmitEvent: true});
diagnostics.buildClientEventFetchRequestOptions(authEvent);
metrics.submitClientEvent({name, options: {diagnosticType: 'auth', correlationId}});

const invalidClientType = {...authOptions, clientType: 'invalid-client' as const};
const invalidSubClientType = {...authOptions, subClientType: 'invalid-sub-client' as const};
const invalidNetworkType = {...authOptions, networkType: 'invalid-network' as const};

// @ts-expect-error Auth submission requires a correlation ID.
submitClientEvent({name, options: {diagnosticType: 'auth'}});
// @ts-expect-error An explicit auth event must use a client type from the Event Dictionary.
metrics.submitClientEvent({name, options: invalidClientType});
// @ts-expect-error An explicit auth event must use a sub-client type from the Event Dictionary.
diagnostics.submitClientEvent({name, options: invalidSubClientType});
// @ts-expect-error A prepared auth request must use a network type from the Event Dictionary.
buildClientEventFetchRequestOptions({name, options: invalidNetworkType});
// @ts-expect-error The diagnostic builder also requires the auth correlation ID.
diagnostics.buildClientEventFetchRequestOptions({name, options: {diagnosticType: 'auth'}});
`;

describe('client event types', () => {
  it('preserves legacy client calls and checks explicit auth options', () => {
    const packageRoot = path.resolve(__dirname, '../../..');
    const sdkRequire = createRequire(path.resolve(packageRoot, '../../../package.json'));
    const ts: typeof import('typescript') = sdkRequire('typescript');
    const configPath = path.join(packageRoot, 'tsconfig.json');
    const {config, error} = ts.readConfigFile(configPath, ts.sys.readFile);

    assert.isUndefined(error, error && ts.flattenDiagnosticMessageText(error.messageText, '\n'));

    const {options, errors} = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      packageRoot,
      {noEmit: true, emitDeclarationOnly: false},
      configPath
    );
    const fixturePath = path.join(packageRoot, 'test/client-events.ts');
    const host = ts.createCompilerHost(options);
    const {getSourceFile} = host;

    host.getSourceFile = (fileName, languageVersion, ...args) =>
      path.resolve(fileName) === fixturePath
        ? ts.createSourceFile(fileName, clientEventFixture, languageVersion)
        : getSourceFile(fileName, languageVersion, ...args);

    const program = ts.createProgram([fixturePath], options, host);
    const diagnostics = [...errors, ...ts.getPreEmitDiagnostics(program)];

    assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, host));
  });
});
