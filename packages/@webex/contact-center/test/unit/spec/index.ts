import path from 'path';
import ts from 'typescript';

const CONTACT_CENTER_ROOT = path.resolve(__dirname, '../../..');
const SRC_ROOT = path.join(CONTACT_CENTER_ROOT, 'src');
const INDEX_PATH = path.join(SRC_ROOT, 'index.ts');
const TYPES_PATH = path.join(SRC_ROOT, 'types.ts');
const CONFIG_TYPES_PATH = path.join(SRC_ROOT, 'services/config/types.ts');

const EXPECTED_ROOT_EXPORTS = Object.freeze([
  'AGENT_EVENTS',
  'AIAssistantEventName',
  'AISummaryActionType',
  'AISummaryFeedback',
  'AI_SUMMARY_ERROR_CODES',
  'AddressBook',
  'AddressBookEntriesResponse',
  'AddressBookEntry',
  'AddressBookEntrySearchParams',
  'AgentContact',
  'AgentEvents',
  'AgentLogin',
  'AgentProfileUpdate',
  'AgentResponse',
  'AgentState',
  'ApiAIAssistant',
  'AuxCode',
  'AuxCodeType',
  'BuddyAgents',
  'BuddyAgentsResponse',
  'BuddyAgentsSuccess',
  'BuddyDetails',
  'CCPluginConfig',
  'CC_AGENT_EVENTS',
  'CC_AI_SUMMARY_EVENTS',
  'CC_EVENTS',
  'CC_TASK_EVENTS',
  'ConsultEndPayload',
  'ConsultPayload',
  'ConsultTransferPayLoad',
  'ContactCenter',
  'ContactCenterEvents',
  'ContactServiceQueue',
  'ContactServiceQueueSearchParams',
  'ContactServiceQueuesResponse',
  'CreateUserPreferenceRequest',
  'DesktopProfileResponse',
  'DeviceType',
  'DeviceTypeUpdateSuccess',
  'DialPlan',
  'DialPlanEntity',
  'DialerPayload',
  'DropConferenceParticipantPayload',
  'Entity',
  'EntryPointListResponse',
  'EntryPointRecord',
  'EntryPointSearchParams',
  'FeatureEnablementEventPayload',
  'GenericError',
  'GetUserPreferenceParams',
  'IContactCenter',
  'IDLE_CODE',
  'IEventEmitter',
  'ITask',
  'Interaction',
  'InteractionUIControls',
  'ListAuxCodesResponse',
  'ListTeamsResponse',
  'LoginOption',
  'Logout',
  'LogoutSuccess',
  'MidCallSummaryEventPayload',
  'MidCallSummaryReceivingAgentPayload',
  'MidCallSummaryResponsePayload',
  'MidCallSummarySections',
  'MidCallSummaryState',
  'MultimediaProfileResponse',
  'OrgInfo',
  'OrgSettings',
  'PostCallSummaryEventPayload',
  'PostCallSummaryResponsePayload',
  'PostCallSummarySections',
  'PostCallSummaryState',
  'Profile',
  'ReloginSuccess',
  'ResumeRecordingPayload',
  'SetStateResponse',
  'SiteInfo',
  'StateChange',
  'StateChangeSuccess',
  'StationLoginResponse',
  'StationLoginSuccess',
  'StationLoginSuccessResponse',
  'StationLogoutResponse',
  'SubscribeRequest',
  'SummaryCounters',
  'TASK_EVENTS',
  'Task',
  'TaskData',
  'TaskEvents',
  'TaskResponse',
  'TaskUIControlState',
  'TaskUIControls',
  'TaskUILeg',
  'TeamList',
  'TenantData',
  'TransferPayLoad',
  'URLMapping',
  'UpdateDeviceTypeResponse',
  'UpdateUserPreferenceRequest',
  'UploadLogsResponse',
  'UserPreference',
  'UserPreferenceData',
  'UserStationLogin',
  'WRAP_UP_CODE',
  'WebSocketEvent',
  'WebexSDK',
  'WrapUpReason',
  'WrapupData',
  'WrapupPayLoad',
  'default',
  'getDefaultUIControls',
  'routingAgent',
]);

const INTERNAL_ROOT_EXPORTS = Object.freeze([
  'AISummaryInboundType',
  'AISummaryPayloadByInboundType',
  'AISummaryTimeoutCodeByInboundType',
  'AISummaryPendingRegistration',
  'AISummaryRequestCoordinator',
  'GeneratedSummaryFlagsAccessor',
  'AISummaryResponseTransportPayload',
  'SummaryResponseTimestamps',
  'PostCallReceivedResponse',
  'PostCallNotReceivedResponse',
  'MidCallReceivedResponse',
  'MidCallUnavailableResponse',
  'AI_SUMMARY_DURATION_MS',
  'AI_SUMMARY_REQUEST_TIMEOUT_MS',
  'AI_SUMMARY_RECEIVER_BUFFER_RETENTION_MS',
  'AI_SUMMARY_FEATURE_ORPHAN_RETENTION_MS',
  'AI_SUMMARY_REQUEST_CANCELLED',
  'AI_ASSISTANT_CLIENT_TYPE',
]);

const EXPECTED_AI_SUMMARY_ERROR_CODES = Object.freeze([
  ['POST_CALL_SUMMARY_DISABLED', 'POST_CALL_SUMMARY_DISABLED'],
  ['MID_CALL_SUMMARY_DISABLED', 'MID_CALL_SUMMARY_DISABLED'],
  ['AI_ASSISTANT_BASE_URL_NOT_AVAILABLE', 'AI_ASSISTANT_BASE_URL_NOT_AVAILABLE'],
  ['POST_CALL_SUMMARY_TIMEOUT', 'POST_CALL_SUMMARY_TIMEOUT'],
  ['MID_CALL_SUMMARY_TIMEOUT', 'MID_CALL_SUMMARY_TIMEOUT'],
  ['AI_SUMMARY_REQUEST_ALREADY_PENDING', 'AI_SUMMARY_REQUEST_ALREADY_PENDING'],
]);

const EXPECTED_AI_SUMMARY_WIRE_LITERALS = Object.freeze({
  AIAssistantEventName: Object.freeze({
    GET_POST_CALL_SUMMARY: 'GET_POST_CALL_SUMMARY',
    GET_MID_CALL_CONSULT_SUMMARY: 'GET_MID_CALL_CONSULT_SUMMARY',
    GET_MID_CALL_TRANSFER_SUMMARY: 'GET_MID_CALL_TRANSFER_SUMMARY',
    POST_CALL_SUMMARY_RESPONSE: 'POST_CALL_SUMMARY_RESPONSE',
    MID_CALL_CONSULT_SUMMARY_RESPONSE: 'MID_CALL_CONSULT_SUMMARY_RESPONSE',
    MID_CALL_TRANSFER_SUMMARY_RESPONSE: 'MID_CALL_TRANSFER_SUMMARY_RESPONSE',
  }),
  CC_AI_SUMMARY_EVENTS: Object.freeze({
    FEATURE_ENABLEMENT: 'FEATURE_ENABLEMENT',
    MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT: 'MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT',
  }),
});

const MISSING_EXPORT_DIAGNOSTIC_CODES = Object.freeze([2305, 2614, 2724]);

const LEGACY_OUTBOUND_SUMMARY_MEMBERS = Object.freeze([
  {
    name: 'GET_MID_CALL_SUMMARY',
    deprecatedText:
      '@deprecated Use GET_MID_CALL_CONSULT_SUMMARY for CONSULT or GET_MID_CALL_TRANSFER_SUMMARY for TRANSFER.',
  },
  {
    name: 'MID_CALL_SUMMARY_RESPONSE',
    deprecatedText:
      '@deprecated Use MID_CALL_CONSULT_SUMMARY_RESPONSE for CONSULT or MID_CALL_TRANSFER_SUMMARY_RESPONSE for TRANSFER.',
  },
]);

const VALID_PUBLIC_CONTRACT_FIXTURE = `
import {
  AIAssistantEventName as AIAssistantEventNames,
  AI_SUMMARY_ERROR_CODES,
  CC_AI_SUMMARY_EVENTS,
  TASK_EVENTS,
} from '../../../src';
import type {
  AIAssistantEventName,
  AISummaryActionType,
  AISummaryFeedback,
  FeatureEnablementEventPayload,
  ITask,
  MidCallSummaryResponsePayload,
  PostCallSummaryResponsePayload,
} from '../../../src';

const action: AISummaryActionType = 'CONSULT';
const transferAction: AISummaryActionType = 'TRANSFER';
const feedback: AISummaryFeedback = 'thumbs_down';
const postCallEnabledTrue: FeatureEnablementEventPayload = {
  interactionId: 'post-call-true',
  postCallEnabled: true,
};
const postCallEnabledFalse: FeatureEnablementEventPayload = {
  interactionId: 'post-call-false',
  postCallEnabled: false,
};
const postCallEnabledOmitted: FeatureEnablementEventPayload = {
  interactionId: 'post-call-omitted',
  midCallEnabled: true,
};
const midCallEnabledTrue: FeatureEnablementEventPayload = {
  interactionId: 'mid-call-true',
  midCallEnabled: true,
};
const midCallEnabledFalse: FeatureEnablementEventPayload = {
  interactionId: 'mid-call-false',
  midCallEnabled: false,
};
const midCallEnabledOmitted: FeatureEnablementEventPayload = {
  interactionId: 'mid-call-omitted',
  postCallEnabled: true,
};

const structuredPostCall: PostCallSummaryResponsePayload = {
  summary: {
    initialContactReason: 'billing',
    additionalContactReasons: 'renewal',
    additionalContext: 'caller asked for an email',
    keyActionsTaken: 'verified account',
    nextSteps: 'send receipt',
  },
  feedback,
  state: 'DEFAULT',
  wrapUpCode: 'resolved',
  numberOfTimesViewed: 1,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
  actionTimeStamp: 100,
  publishTimestamp: 200,
};
const textPostCall: PostCallSummaryResponsePayload = {
  summary: 'plain post call summary',
  feedback: 'thumbs_up',
  state: 'IGNORED',
  wrapUpCode: 'ignored',
  numberOfTimesViewed: 2,
  numberOfTimesEdited: 1,
  numberOfTimesCopied: 1,
};
const noPostCallSummary: PostCallSummaryResponsePayload = {
  summary: '',
  feedback: 'none',
  state: 'NOT_RECEIVED',
  wrapUpCode: 'not-received',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
  actionTimeStamp: 0,
  publishTimestamp: 0,
};

const structuredMidCall: MidCallSummaryResponsePayload = {
  summaryReceived: true,
  summary: {
    reasonForTransferOrConsult: 'expert needed',
    additionalContext: 'customer has prior ticket',
    keyActionsTaken: 'authenticated caller',
  },
  feedback: 'none',
  state: 'EXCLUDED',
  numberOfTimesViewed: 1,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
  actionTimeStamp: 300,
};
const textMidCall: MidCallSummaryResponsePayload = {
  summaryReceived: true,
  summary: 'plain mid call summary',
  feedback: 'thumbs_up',
  state: 'MID_CALL_CANCELLED',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
  publishTimestamp: 400,
};
const unavailableMidCall: MidCallSummaryResponsePayload = {
  summaryReceived: false,
  summary: '',
  feedback: 'thumbs_down',
  state: 'NOT_RECEIVED',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
};
const cancelledMidCall: MidCallSummaryResponsePayload = {
  summaryReceived: false,
  summary: '',
  feedback: 'none',
  state: 'MID_CALL_CANCELLED',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
  actionTimeStamp: 500,
  publishTimestamp: 600,
};

const taskSummaryMethods: Pick<
  ITask,
  | 'requestPostCallSummary'
  | 'sendPostCallSummaryResponse'
  | 'requestMidCallSummary'
  | 'sendMidCallSummaryResponse'
> = {
  requestPostCallSummary: async () => ({conversationId: 'conversation-1'}),
  sendPostCallSummaryResponse: async (payload) => {
    const responseState = payload.state;
    void responseState;
  },
  requestMidCallSummary: async (requestedAction) => {
    const selectedAction: AISummaryActionType = requestedAction;
    void selectedAction;
    return {conversationId: 'conversation-1'};
  },
  sendMidCallSummaryResponse: async (payload, requestedAction) => {
    const selectedAction: AISummaryActionType = requestedAction;
    const responseState = payload.state;
    void selectedAction;
    void responseState;
  },
};

const outboundGet: AIAssistantEventName = AIAssistantEventNames.GET_MID_CALL_CONSULT_SUMMARY;
const outboundResponse: AIAssistantEventName = AIAssistantEventNames.MID_CALL_TRANSFER_SUMMARY_RESPONSE;
const inboundPost = CC_AI_SUMMARY_EVENTS.POST_CALL_SUMMARY;
const receivingEvent = TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT;
const disabledCode = AI_SUMMARY_ERROR_CODES.POST_CALL_SUMMARY_DISABLED;
void action;
void transferAction;
void postCallEnabledTrue;
void postCallEnabledFalse;
void postCallEnabledOmitted;
void midCallEnabledTrue;
void midCallEnabledFalse;
void midCallEnabledOmitted;
void structuredPostCall;
void textPostCall;
void noPostCallSummary;
void structuredMidCall;
void textMidCall;
void unavailableMidCall;
void cancelledMidCall;
void taskSummaryMethods;
void outboundGet;
void outboundResponse;
void inboundPost;
void receivingEvent;
void disabledCode;
`;

const createInternalRootImportFixture = () => `
import {
${INTERNAL_ROOT_EXPORTS.map((name) => `  ${name},`).join('\n')}
} from '../../../src';

void [
${INTERNAL_ROOT_EXPORTS.map((name) => `  ${name},`).join('\n')}
];
`;

const INVALID_PUBLIC_CONTRACT_FIXTURE = `
import {
  type AISummaryActionType,
  type FeatureEnablementEventPayload,
  type MidCallSummaryResponsePayload,
  type PostCallSummaryResponsePayload,
} from '../../../src';

let invalidAction: AISummaryActionType;
// @ts-expect-error invalid summary action type must not widen
invalidAction = 'WRAP_UP';
void invalidAction;

// @ts-expect-error postCallEnabled must stay boolean; string values must not satisfy the public flag contract
const invalidPostCallEnabledString: FeatureEnablementEventPayload = {interactionId: 'interaction-1', postCallEnabled: 'true'};
void invalidPostCallEnabledString;

// @ts-expect-error postCallEnabled must stay boolean; number values must not satisfy the public flag contract
const invalidPostCallEnabledNumber: FeatureEnablementEventPayload = {interactionId: 'interaction-2', postCallEnabled: 1};
void invalidPostCallEnabledNumber;

// @ts-expect-error midCallEnabled must stay boolean; string values must not satisfy the public flag contract
const invalidMidCallEnabledString: FeatureEnablementEventPayload = {interactionId: 'interaction-3', midCallEnabled: 'false'};
void invalidMidCallEnabledString;

// @ts-expect-error midCallEnabled must stay boolean; number values must not satisfy the public flag contract
const invalidMidCallEnabledNumber: FeatureEnablementEventPayload = {interactionId: 'interaction-4', midCallEnabled: 0};
void invalidMidCallEnabledNumber;

// @ts-expect-error invalid post-call response state must not be accepted
const invalidPostCallState: PostCallSummaryResponsePayload = {summary: 'x', feedback: 'none', state: 'EXCLUDED', wrapUpCode: 'wrap', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidPostCallState;

// @ts-expect-error invalid summary feedback must not be accepted
const invalidFeedback: PostCallSummaryResponsePayload = {summary: 'x', feedback: 'ok', state: 'DEFAULT', wrapUpCode: 'wrap', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidFeedback;

// @ts-expect-error invalid mid-call summaryReceived discriminator must not be accepted
const invalidDiscriminator: MidCallSummaryResponsePayload = {summaryReceived: 'true', summary: 'x', feedback: 'none', state: 'DEFAULT', agentName: 'Agent', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidDiscriminator;

// @ts-expect-error invalid mid-call response state must not be accepted
const invalidMidCallState: MidCallSummaryResponsePayload = {summaryReceived: true, summary: 'x', feedback: 'none', state: 'POST_CALL_ONLY', agentName: 'Agent', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidMidCallState;

// @ts-expect-error mid-call response object literal with wrapUpCode own key must not be accepted
const invalidMidCallWrapUpCode: MidCallSummaryResponsePayload = {summaryReceived: true, summary: 'x', feedback: 'none', state: 'DEFAULT', agentName: 'Agent', wrapUpCode: 'wrap', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidMidCallWrapUpCode;
`;

const LEGACY_TASK_CALL_CONTROL_CONTRACT_FIXTURE = `
import type {
  ITask,
  TaskResponse,
} from '../../../src';

type IsExact<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends
  (<Value>() => Value extends Expected ? 1 : 2)
    ? (<Value>() => Value extends Expected ? 1 : 2) extends
      (<Value>() => Value extends Actual ? 1 : 2)
      ? true
      : false
    : false;
type AssertExact<Actual extends true> = Actual;

type ExpectedWrapupParameters = [
  wrapupPayload: {
    wrapUpReason: string;
    auxCodeId: string;
  },
];
type ExpectedConsultParameters = [
  consultPayload: {
    to: string | undefined;
    destinationType: string;
    holdParticipants?: boolean;
  },
];
type ExpectedTransferParameters = [
  transferPayload: {
    to: string;
    destinationType: string;
  },
  options?: {
    [key: string]: unknown;
  },
];

type WrapupParametersAreRetained = AssertExact<
  IsExact<Parameters<ITask['wrapup']>, ExpectedWrapupParameters>
>;
type WrapupReturnIsRetained = AssertExact<
  IsExact<ReturnType<ITask['wrapup']>, Promise<TaskResponse>>
>;
type ConsultParametersAreRetained = AssertExact<
  IsExact<Parameters<ITask['consult']>, ExpectedConsultParameters>
>;
type ConsultReturnIsRetained = AssertExact<
  IsExact<ReturnType<ITask['consult']>, Promise<TaskResponse>>
>;
type TransferParametersAreRetained = AssertExact<
  IsExact<Parameters<ITask['transfer']>, ExpectedTransferParameters>
>;
type TransferReturnIsRetained = AssertExact<
  IsExact<ReturnType<ITask['transfer']>, Promise<TaskResponse>>
>;

declare const task: ITask;

const wrapupResult: Promise<TaskResponse> = task.wrapup({
  wrapUpReason: 'Customer issue resolved',
  auxCodeId: 'RESOLVED',
});
const consultResult: Promise<TaskResponse> = task.consult({
  to: 'agent-1',
  destinationType: 'agent',
});
const consultWithOptionalHoldResult: Promise<TaskResponse> = task.consult({
  to: undefined,
  destinationType: 'queue',
  holdParticipants: true,
});
const transferResult: Promise<TaskResponse> = task.transfer({
  to: 'queue-1',
  destinationType: 'queue',
});
const transferWithOptionsResult: Promise<TaskResponse> = task.transfer(
  {
    to: 'agent-2',
    destinationType: 'agent',
  },
  {trackingId: 'transfer-1'}
);

// @ts-expect-error wrapup must keep requiring its retained payload tuple
task.wrapup();
// @ts-expect-error wrapup payload must keep auxCodeId as a required field
task.wrapup({wrapUpReason: 'Customer issue resolved'});
// @ts-expect-error wrapup payload must not accept AI summary response fields threaded into the call control API
task.wrapup({wrapUpReason: 'Customer issue resolved', auxCodeId: 'RESOLVED', actionTimeStamp: 100});
// @ts-expect-error wrapup payload must not accept post-call summary state as a control argument
task.wrapup({wrapUpReason: 'Customer issue resolved', auxCodeId: 'RESOLVED', state: 'DEFAULT'});

// @ts-expect-error consult must keep requiring its retained payload tuple
task.consult();
// @ts-expect-error consult payload must keep destinationType as a string
task.consult({to: 'agent-1', destinationType: 1});
// @ts-expect-error consult payload must not accept mid-call summary action fields threaded into the payload
task.consult({to: 'agent-1', destinationType: 'agent', actionType: 'CONSULT'});
// @ts-expect-error consult must not accept a feature action as a second argument
task.consult({to: 'agent-1', destinationType: 'agent'}, 'CONSULT');

// @ts-expect-error transfer must keep requiring its retained payload tuple
task.transfer();
// @ts-expect-error transfer payload must keep to as a required string field
task.transfer({destinationType: 'queue'});
// @ts-expect-error transfer payload must keep destinationType as a string
task.transfer({to: 'queue-1', destinationType: 1});
// @ts-expect-error transfer payload must not accept mid-call summary action fields threaded into the payload
task.transfer({to: 'agent-2', destinationType: 'agent', actionType: 'TRANSFER'});
// @ts-expect-error transfer options must not be replaced by a feature action argument
task.transfer({to: 'agent-2', destinationType: 'agent'}, 'TRANSFER');
// @ts-expect-error transfer must not accept a third feature action argument
task.transfer({to: 'agent-2', destinationType: 'agent'}, {trackingId: 'transfer-2'}, 'TRANSFER');

void wrapupResult;
void consultResult;
void consultWithOptionalHoldResult;
void transferResult;
void transferWithOptionsResult;
`;

const LEGACY_OUTBOUND_VIOLATING_PRODUCTION_FIXTURE = `
import {AIAssistantEventName, AIAssistantEventName as AIEventName} from './types';

const propertyAccess = AIAssistantEventName.GET_MID_CALL_SUMMARY;
const aliasPropertyAccess = AIEventName.MID_CALL_SUMMARY_RESPONSE;
const elementAccess = AIAssistantEventName['GET_MID_CALL_SUMMARY'];
const {MID_CALL_SUMMARY_RESPONSE: bindingAlias} = AIAssistantEventName;
const {GET_MID_CALL_SUMMARY} = AIAssistantEventName;
let MID_CALL_SUMMARY_RESPONSE = '';
({MID_CALL_SUMMARY_RESPONSE} = AIAssistantEventName);

void propertyAccess;
void aliasPropertyAccess;
void elementAccess;
void bindingAlias;
void GET_MID_CALL_SUMMARY;
void MID_CALL_SUMMARY_RESPONSE;
`;

const LEGACY_OUTBOUND_SAFE_PRODUCTION_FIXTURE = `
export {};

const unrelatedLiteral = 'GET_MID_CALL_SUMMARY';
const unrelatedObject = {
  GET_MID_CALL_SUMMARY: 'GET_MID_CALL_SUMMARY',
  MID_CALL_SUMMARY_RESPONSE: 'MID_CALL_SUMMARY_RESPONSE',
};
const unrelatedElementAccess = unrelatedObject['GET_MID_CALL_SUMMARY'];
const {MID_CALL_SUMMARY_RESPONSE: unrelatedBindingAlias} = unrelatedObject;
let GET_MID_CALL_SUMMARY = '';
({GET_MID_CALL_SUMMARY} = unrelatedObject);
const unrelatedShorthandObject = {GET_MID_CALL_SUMMARY};

void unrelatedLiteral;
void unrelatedElementAccess;
void unrelatedBindingAlias;
void GET_MID_CALL_SUMMARY;
void unrelatedShorthandObject;
`;

const createProgram = (virtualSources: Record<string, string> = {}) => {
  const configPath = path.join(CONTACT_CENTER_ROOT, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    CONTACT_CENTER_ROOT,
    {emitDeclarationOnly: false, noEmit: true},
    configPath
  );
  const virtualFileNames = Object.keys(virtualSources);
  const host = ts.createCompilerHost(parsed.options, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const normalizedFileName = path.normalize(fileName);
    if (Object.prototype.hasOwnProperty.call(virtualSources, normalizedFileName)) {
      return ts.createSourceFile(
        normalizedFileName,
        virtualSources[normalizedFileName],
        languageVersion,
        true
      );
    }

    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );
  };

  host.fileExists = (fileName) => {
    const normalizedFileName = path.normalize(fileName);
    return Object.prototype.hasOwnProperty.call(virtualSources, normalizedFileName)
      ? true
      : originalFileExists(fileName);
  };

  host.readFile = (fileName) => {
    const normalizedFileName = path.normalize(fileName);
    return Object.prototype.hasOwnProperty.call(virtualSources, normalizedFileName)
      ? virtualSources[normalizedFileName]
      : originalReadFile(fileName);
  };

  return ts.createProgram([...parsed.fileNames, ...virtualFileNames], parsed.options, host);
};

const getRootModuleSymbol = (program: ts.Program) => {
  const checker = program.getTypeChecker();
  const indexSource = program.getSourceFile(INDEX_PATH);
  if (!indexSource) {
    throw new Error(`Missing source file ${INDEX_PATH}`);
  }
  const moduleSymbol = checker.getSymbolAtLocation(indexSource);
  if (!moduleSymbol) {
    throw new Error('Unable to resolve contact-center root module symbol');
  }

  return moduleSymbol;
};

const getRootExportNames = (program: ts.Program) => {
  const checker = program.getTypeChecker();

  return checker
    .getExportsOfModule(getRootModuleSymbol(program))
    .map((symbol) => symbol.getName())
    .sort();
};

const getRootExportSymbol = (program: ts.Program, exportName: string) => {
  const checker = program.getTypeChecker();
  const exportSymbol = checker
    .getExportsOfModule(getRootModuleSymbol(program))
    .find((symbol) => symbol.getName() === exportName);

  if (!exportSymbol) {
    throw new Error(`Missing root export ${exportName}`);
  }

  return resolveSymbol(checker, exportSymbol);
};

const getDiagnosticsForFiles = (program: ts.Program, fileNames: string[]) =>
  ts.getPreEmitDiagnostics(program).filter((diagnostic) => {
    const fileName = diagnostic.file?.fileName;

    return !!fileName && fileNames.includes(fileName);
  });

const getMissingExportNameFromDiagnostic = (diagnostic: ts.Diagnostic) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const match = message.match(/has no exported member(?: named)? '([^']+)'/);

  if (!match) {
    throw new Error(`Unexpected TS${diagnostic.code} diagnostic: ${message}`);
  }

  return match[1];
};

const getCanonicalMissingExportDiagnosticCode = (diagnostic: ts.Diagnostic) => {
  if (
    MISSING_EXPORT_DIAGNOSTIC_CODES.includes(diagnostic.code) &&
    getMissingExportNameFromDiagnostic(diagnostic)
  ) {
    return 2305;
  }

  return diagnostic.code;
};

const getObjectLiteralInitializer = (symbol: ts.Symbol | undefined, symbolName: string) => {
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

  if (!declaration || !ts.isVariableDeclaration(declaration)) {
    throw new Error(`Root export ${symbolName} does not resolve to a variable declaration`);
  }

  let initializer = declaration.initializer;
  if (!initializer) {
    throw new Error(`Root export ${symbolName} is missing an initializer`);
  }

  while (ts.isAsExpression(initializer)) {
    initializer = initializer.expression;
  }

  if (!ts.isObjectLiteralExpression(initializer)) {
    throw new Error(`Root export ${symbolName} does not resolve to an object literal`);
  }

  return initializer;
};

const getStringLiteralObjectEntries = (objectLiteral: ts.ObjectLiteralExpression) =>
  objectLiteral.properties.map((property) => {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      !ts.isStringLiteral(property.initializer)
    ) {
      throw new Error('Expected string-literal object property assignment');
    }

    return [property.name.text, property.initializer.text];
  });

const getNamedStringLiteralObjectEntries = (
  objectLiteral: ts.ObjectLiteralExpression,
  propertyNames: string[],
  symbolName: string
) =>
  propertyNames.map((propertyName) => {
    const property = objectLiteral.properties.find(
      (candidate): candidate is ts.PropertyAssignment =>
        ts.isPropertyAssignment(candidate) &&
        ts.isIdentifier(candidate.name) &&
        candidate.name.text === propertyName
    );

    if (!property) {
      throw new Error(`Missing ${symbolName}.${propertyName}`);
    }

    if (!ts.isStringLiteral(property.initializer)) {
      throw new Error(`Expected ${symbolName}.${propertyName} to be a string literal`);
    }

    return [propertyName, property.initializer.text];
  });

const getObjectLiteralVariableInitializer = (
  sourceFile: ts.SourceFile,
  variableName: string
) => {
  let objectLiteral: ts.ObjectLiteralExpression | undefined;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      const initializer = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;

      if (!ts.isObjectLiteralExpression(initializer)) {
        throw new Error(`${variableName} does not resolve to an object literal`);
      }

      objectLiteral = initializer;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!objectLiteral) {
    throw new Error(`Missing ${variableName} object literal`);
  }

  return objectLiteral;
};

const getObjectLiteralPropertyAssignment = (
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
  symbolName: string
) => {
  const property = objectLiteral.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === propertyName
  );

  if (!property) {
    throw new Error(`Missing ${symbolName}.${propertyName}`);
  }

  return property;
};

const entriesToObject = (entries: string[][]) =>
  entries.reduce<Record<string, string>>((accumulator, [name, value]) => {
    accumulator[name] = value;

    return accumulator;
  }, {});

const findAIAssistantEventNameProperty = (
  sourceFile: ts.SourceFile,
  propertyName: string
): ts.PropertyAssignment => {
  let found: ts.PropertyAssignment | undefined;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'AIAssistantEventName' &&
      node.initializer
    ) {
      const initializer = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (!ts.isObjectLiteralExpression(initializer)) {
        return;
      }
      found = initializer.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === propertyName
      );
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!found) {
    throw new Error(`Missing AIAssistantEventName.${propertyName}`);
  }

  return found;
};

const getLeadingComment = (sourceFile: ts.SourceFile, node: ts.Node) => {
  const sourceText = sourceFile.getFullText();
  const comments = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) ?? [];

  return comments.map((comment) => sourceText.slice(comment.pos, comment.end)).join('\n');
};

const isInsideNode = (candidate: ts.Node, boundary: ts.Node) =>
  candidate.getSourceFile() === boundary.getSourceFile() &&
  candidate.getStart() >= boundary.getStart() &&
  candidate.getEnd() <= boundary.getEnd();

const resolveSymbol = (checker: ts.TypeChecker, symbol: ts.Symbol | undefined) => {
  if (!symbol) return undefined;

  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
};

type LegacyOutboundSummaryDeclaration = {
  name: string;
  declaration: ts.PropertyAssignment;
};

type LegacyOutboundSummaryViolation = {
  fileName: string;
  line: number;
  name: string;
};

const getLegacyOutboundSummaryDeclarations = (
  program: ts.Program
): LegacyOutboundSummaryDeclaration[] => {
  const typesSource = program.getSourceFile(TYPES_PATH);
  if (!typesSource) {
    throw new Error(`Missing source file ${TYPES_PATH}`);
  }

  return LEGACY_OUTBOUND_SUMMARY_MEMBERS.map((member) => ({
    name: member.name,
    declaration: findAIAssistantEventNameProperty(typesSource, member.name),
  }));
};

const getObjectBindingInitializer = (bindingElement: ts.BindingElement) => {
  const bindingOwner = bindingElement.parent.parent;

  if (ts.isVariableDeclaration(bindingOwner)) {
    return bindingOwner.initializer;
  }

  if (ts.isParameter(bindingOwner)) {
    return bindingOwner.initializer;
  }

  return undefined;
};

const getBindingElementSourcePropertySymbol = (
  checker: ts.TypeChecker,
  node: ts.Identifier | ts.StringLiteral
) => {
  if (!ts.isBindingElement(node.parent) || !ts.isObjectBindingPattern(node.parent.parent)) {
    return undefined;
  }

  const bindingElement = node.parent;
  const propertyName = bindingElement.propertyName;
  const referencedName =
    propertyName === node
      ? node.text
      : !propertyName && bindingElement.name === node && ts.isIdentifier(node)
        ? node.text
        : undefined;
  if (!referencedName) {
    return undefined;
  }

  const initializer = getObjectBindingInitializer(bindingElement);
  if (!initializer) {
    return undefined;
  }

  return resolveSymbol(checker, checker.getTypeAtLocation(initializer).getProperty(referencedName));
};

const isDestructuringAssignmentObject = (objectLiteral: ts.ObjectLiteralExpression) => {
  let leftExpression: ts.Expression = objectLiteral;
  let parent: ts.Node = objectLiteral.parent;

  while (ts.isParenthesizedExpression(parent)) {
    leftExpression = parent;
    parent = parent.parent;
  }

  return (
    ts.isBinaryExpression(parent) &&
    parent.left === leftExpression &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );
};

const getAssignmentDestructuringSourcePropertySymbol = (
  checker: ts.TypeChecker,
  node: ts.Identifier
) => {
  const parent = node.parent;
  const propertyNameBelongsToAssignmentObject =
    ((ts.isShorthandPropertyAssignment(parent) && parent.name === node) ||
      (ts.isPropertyAssignment(parent) && parent.name === node)) &&
    ts.isObjectLiteralExpression(parent.parent) &&
    isDestructuringAssignmentObject(parent.parent);

  return propertyNameBelongsToAssignmentObject
    ? resolveSymbol(checker, checker.getPropertySymbolOfDestructuringAssignment(node))
    : undefined;
};

const getElementAccessSourcePropertySymbol = (
  checker: ts.TypeChecker,
  node: ts.StringLiteral
) => {
  if (
    !ts.isElementAccessExpression(node.parent) ||
    node.parent.argumentExpression !== node
  ) {
    return undefined;
  }

  return resolveSymbol(
    checker,
    checker.getTypeAtLocation(node.parent.expression).getProperty(node.text)
  );
};

const getDeprecatedMemberReferenceSymbol = (
  checker: ts.TypeChecker,
  node: ts.Identifier | ts.StringLiteral
) => {
  if (ts.isIdentifier(node)) {
    const bindingElementSourceProperty = getBindingElementSourcePropertySymbol(checker, node);
    if (bindingElementSourceProperty) {
      return bindingElementSourceProperty;
    }

    const assignmentDestructuringSourceProperty =
      getAssignmentDestructuringSourcePropertySymbol(checker, node);
    if (assignmentDestructuringSourceProperty) {
      return assignmentDestructuringSourceProperty;
    }
  }

  if (ts.isStringLiteral(node)) {
    const bindingElementSourceProperty = getBindingElementSourcePropertySymbol(checker, node);
    if (bindingElementSourceProperty) {
      return bindingElementSourceProperty;
    }

    const elementAccessSourceProperty = getElementAccessSourcePropertySymbol(checker, node);
    if (elementAccessSourceProperty) {
      return elementAccessSourceProperty;
    }
  }

  return resolveSymbol(checker, checker.getSymbolAtLocation(node));
};

const symbolReferencesDeclaration = (
  symbol: ts.Symbol | undefined,
  declaration: ts.PropertyAssignment
) =>
  symbol?.declarations?.some((symbolDeclaration) => isInsideNode(symbolDeclaration, declaration)) ??
  false;

const formatLegacyOutboundSummaryViolations = (
  violations: LegacyOutboundSummaryViolation[]
) =>
  violations.map(
    (violation) =>
      `${path.relative(CONTACT_CENTER_ROOT, violation.fileName)}:${violation.line}:${violation.name}`
  );

const findLegacyOutboundSummaryProductionViolations = (program: ts.Program) => {
  const checker = program.getTypeChecker();
  const legacyDeclarations = getLegacyOutboundSummaryDeclarations(program);
  const violations: LegacyOutboundSummaryViolation[] = [];

  program
    .getSourceFiles()
    .filter(
      (sourceFile) =>
        !sourceFile.isDeclarationFile &&
        path.normalize(sourceFile.fileName).startsWith(path.normalize(SRC_ROOT))
    )
    .forEach((sourceFile) => {
      const visit = (node: ts.Node) => {
        legacyDeclarations.forEach(({name, declaration}) => {
          if (isInsideNode(node, declaration)) {
            return;
          }

          const isNamedNode =
            (ts.isIdentifier(node) || ts.isStringLiteral(node)) && node.text === name;
          if (!isNamedNode) {
            return;
          }

          if (
            symbolReferencesDeclaration(
              getDeprecatedMemberReferenceSymbol(checker, node),
              declaration
            )
          ) {
            violations.push({
              fileName: sourceFile.fileName,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              name,
            });
          }
        });

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    });

  return violations;
};

const createSameOffsetLegacyReferenceFixture = (
  declaration: ts.PropertyAssignment,
  name: string
) => {
  const importStatement = "import {AIAssistantEventName} from './types';\n";
  const statementPrefix = 'void AIAssistantEventName.';
  const paddingLength = declaration.getStart() - importStatement.length - statementPrefix.length;

  return `${importStatement}${' '.repeat(Math.max(0, paddingLength))}${statementPrefix}${name};\n`;
};

describe('contact-center root public contract', () => {
  it('preserves the literal root barrel export list and omits package internals', () => {
    const program = createProgram();
    const exportNames = getRootExportNames(program);

    expect(exportNames).toEqual([...EXPECTED_ROOT_EXPORTS].sort());
    INTERNAL_ROOT_EXPORTS.forEach((name) => {
      expect(exportNames).not.toContain(name);
    });
  });

  it('rejects root imports of package internals with TS2305 diagnostics', () => {
    const internalFixture = path.join(
      CONTACT_CENTER_ROOT,
      'test/unit/spec/__root_internals.ts'
    );
    const program = createProgram({
      [internalFixture]: createInternalRootImportFixture(),
    });
    const diagnostics = getDiagnosticsForFiles(program, [internalFixture]);

    expect(diagnostics.map(getCanonicalMissingExportDiagnosticCode)).toEqual(
      INTERNAL_ROOT_EXPORTS.map(() => 2305)
    );
    expect(diagnostics.map(getMissingExportNameFromDiagnostic).sort()).toEqual(
      [...INTERNAL_ROOT_EXPORTS].sort()
    );
  });

  it('re-exports the exact AI summary error code object from the root symbol', () => {
    const program = createProgram();
    const errorCodeEntries = getStringLiteralObjectEntries(
      getObjectLiteralInitializer(
        getRootExportSymbol(program, 'AI_SUMMARY_ERROR_CODES'),
        'AI_SUMMARY_ERROR_CODES'
      )
    );

    expect(errorCodeEntries).toEqual(EXPECTED_AI_SUMMARY_ERROR_CODES);
  });

  it('pins AI summary wire event literals to the backend contract', () => {
    const program = createProgram();
    const aiAssistantEventNameLiterals = entriesToObject(
      getNamedStringLiteralObjectEntries(
        getObjectLiteralInitializer(
          getRootExportSymbol(program, 'AIAssistantEventName'),
          'AIAssistantEventName'
        ),
        Object.keys(EXPECTED_AI_SUMMARY_WIRE_LITERALS.AIAssistantEventName),
        'AIAssistantEventName'
      )
    );
    const ccAISummaryEventLiterals = entriesToObject(
      getNamedStringLiteralObjectEntries(
        getObjectLiteralInitializer(
          getRootExportSymbol(program, 'CC_AI_SUMMARY_EVENTS'),
          'CC_AI_SUMMARY_EVENTS'
        ),
        Object.keys(EXPECTED_AI_SUMMARY_WIRE_LITERALS.CC_AI_SUMMARY_EVENTS),
        'CC_AI_SUMMARY_EVENTS'
      )
    );

    expect({
      AIAssistantEventName: aiAssistantEventNameLiterals,
      CC_AI_SUMMARY_EVENTS: ccAISummaryEventLiterals,
    }).toEqual(EXPECTED_AI_SUMMARY_WIRE_LITERALS);
  });

  it('keeps legacy outbound mid-call summary names deprecated and unused in production', () => {
    const program = createProgram();
    const typesSource = program.getSourceFile(TYPES_PATH);
    if (!typesSource) {
      throw new Error(`Missing source file ${TYPES_PATH}`);
    }

    const legacyDeclarations = getLegacyOutboundSummaryDeclarations(program);

    legacyDeclarations.forEach(({name, declaration}) => {
      const comment = getLeadingComment(typesSource, declaration);
      const member = LEGACY_OUTBOUND_SUMMARY_MEMBERS.find(
        (legacyMember) => legacyMember.name === name
      );
      if (!member) {
        throw new Error(`Missing legacy member metadata for ${name}`);
      }

      expect(comment).toContain(member.deprecatedText);
    });

    expect(
      formatLegacyOutboundSummaryViolations(
        findLegacyOutboundSummaryProductionViolations(program)
      )
    ).toEqual([]);
  });

  it('detects symbol-backed legacy outbound references without text-only false positives', () => {
    const baselineProgram = createProgram();
    const sameOffsetDeclaration = getLegacyOutboundSummaryDeclarations(baselineProgram).find(
      (declaration) => declaration.name === 'GET_MID_CALL_SUMMARY'
    )?.declaration;

    if (!sameOffsetDeclaration) {
      throw new Error('Missing same-offset legacy declaration fixture target');
    }

    const violatingFixture = path.join(SRC_ROOT, '__legacy_outbound_violating.ts');
    const safeFixture = path.join(SRC_ROOT, '__legacy_outbound_safe.ts');
    const sameOffsetFixture = path.join(SRC_ROOT, '__legacy_outbound_same_offset.ts');
    const program = createProgram({
      [violatingFixture]: LEGACY_OUTBOUND_VIOLATING_PRODUCTION_FIXTURE,
      [safeFixture]: LEGACY_OUTBOUND_SAFE_PRODUCTION_FIXTURE,
      [sameOffsetFixture]: createSameOffsetLegacyReferenceFixture(
        sameOffsetDeclaration,
        'GET_MID_CALL_SUMMARY'
      ),
    });
    const violations = findLegacyOutboundSummaryProductionViolations(program);
    const violationFacts = violations
      .map((violation) => `${path.basename(violation.fileName)}:${violation.name}`)
      .sort();

    expect(violationFacts).toEqual(
      [
        '__legacy_outbound_same_offset.ts:GET_MID_CALL_SUMMARY',
        '__legacy_outbound_violating.ts:GET_MID_CALL_SUMMARY',
        '__legacy_outbound_violating.ts:GET_MID_CALL_SUMMARY',
        '__legacy_outbound_violating.ts:GET_MID_CALL_SUMMARY',
        '__legacy_outbound_violating.ts:MID_CALL_SUMMARY_RESPONSE',
        '__legacy_outbound_violating.ts:MID_CALL_SUMMARY_RESPONSE',
        '__legacy_outbound_violating.ts:MID_CALL_SUMMARY_RESPONSE',
      ].sort()
    );
    expect(violations.some((violation) => violation.fileName === safeFixture)).toBe(false);
  });

  it('type-checks public AI summary assignments and keeps invalid branches narrow', () => {
    const validFixture = path.join(CONTACT_CENTER_ROOT, 'test/unit/spec/__ai_summary_valid.ts');
    const invalidFixture = path.join(
      CONTACT_CENTER_ROOT,
      'test/unit/spec/__ai_summary_invalid.ts'
    );
    const program = createProgram({
      [validFixture]: VALID_PUBLIC_CONTRACT_FIXTURE,
      [invalidFixture]: INVALID_PUBLIC_CONTRACT_FIXTURE,
    });
    const fixtureDiagnostics = getDiagnosticsForFiles(program, [validFixture, invalidFixture]);

    expect(
      fixtureDiagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }))
    ).toEqual([]);
  });

  it('pins retained ITask wrapup, consult, and transfer signatures', () => {
    const legacyTaskContractFixture = path.join(
      CONTACT_CENTER_ROOT,
      'test/unit/spec/__legacy_task_call_control_contract.ts'
    );
    const program = createProgram({
      [legacyTaskContractFixture]: LEGACY_TASK_CALL_CONTROL_CONTRACT_FIXTURE,
    });
    const fixtureDiagnostics = getDiagnosticsForFiles(program, [legacyTaskContractFixture]);

    expect(
      fixtureDiagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }))
    ).toEqual([]);
  });
});
