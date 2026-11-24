import path from 'path';
import fs from 'fs';
import ts from 'typescript';

const CONTACT_CENTER_ROOT = path.resolve(__dirname, '../../..');
const SRC_ROOT = path.join(CONTACT_CENTER_ROOT, 'src');
const INDEX_PATH = path.join(SRC_ROOT, 'index.ts');
const TYPES_PATH = path.join(SRC_ROOT, 'types.ts');
const CONFIG_TYPES_PATH = path.join(SRC_ROOT, 'services/config/types.ts');

const EXPECTED_ROOT_EXPORTS = Object.freeze([
  'REGION_RECOVERY_EVENTS',
  'REGION_RECOVERY_ERROR_CODES',
  'RegionRecoveryErrorCode',
  'RegionRecoveryStatus',
  'RegionRecoveryReason',
  'RegionAutoAvailableStatus',
  'RegionRecoveryState',
  'AGENT_EVENTS',
  'AISummaryAction',
  'AISummary',
  'AISummaryFeedback',
  'AISummaryResponse',
  'AISummarySections',
  'AISummaryState',
  'AI_SUMMARY_ERROR_CODES',
  'AddressBook',
  'AddressBookEntriesResponse',
  'AddressBookEntry',
  'AddressBookEntrySearchParams',
  'AgentContact',
  'AgentEvents',
  'AgentLogin',
  'AgentProfile',
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
  'CC_TASK_EVENTS',
  'CC_EVENTS',
  'ConsultEndPayload',
  'ConsultPayload',
  'ConsultTransferPayLoad',
  'ContactCenter',
  'ContactCenterEvents',
  'ContactServiceQueue',
  'ContactServiceQueueSearchParams',
  'ContactServiceQueuesResponse',
  'CreateUserPreferenceRequest',
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
  'AISummaryFeatureEnablement',
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
  'MicrosoftConfig',
  'MultimediaProfileResponse',
  'OrgDesktopLoginResponse',
  'OrgInfo',
  'OrgSettings',
  'OrgUrlMappings',
  'Profile',
  'ReloginSuccess',
  'RespondToWellnessBreakParams',
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
  'UpdateDeviceTypeResponse',
  'UpdateUserPreferenceRequest',
  'UploadLogsResponse',
  'UserDesktopLoginResponse',
  'UserPreference',
  'UserPreferenceData',
  'UserStationLogin',
  'VOICE_CONNECTION_ERROR',
  'VOICE_CONNECTION_EVENTS',
  'VOICE_CONNECTION_STATUS',
  'VoiceConnectionState',
  'VoiceLineStatus',
  'VoiceMobiusSocketStatus',
  'WELLNESS_BREAK_NOTIFICATION_ACTIONS',
  'WELLNESS_BREAK_USER_ACTIONS',
  'WRAP_UP_CODE',
  'WebSocketEvent',
  'WebexConfig',
  'WebexSDK',
  'WellnessBreakEvent',
  'WellnessBreakNotificationAction',
  'WellnessBreakUserAction',
  'WrapUpReason',
  'WrapupData',
  'WrapupPayLoad',
  'default',
  'getDefaultUIControls',
  'routingAgent',
]);

const EXPECTED_CC_EVENT_CATALOGS = {
  "CC_AGENT_EVENTS": {
    "WELCOME": "Welcome",
    "AGENT_RELOGIN_SUCCESS": "AgentReloginSuccess",
    "AGENT_RELOGIN_FAILED": "AgentReloginFailed",
    "AGENT_DN_REGISTERED": "AgentDNRegistered",
    "AGENT_LOGOUT": "Logout",
    "AGENT_LOGOUT_SUCCESS": "AgentLogoutSuccess",
    "AGENT_LOGOUT_FAILED": "AgentLogoutFailed",
    "AGENT_STATION_LOGIN": "StationLogin",
    "AGENT_STATION_LOGIN_SUCCESS": "AgentStationLoginSuccess",
    "AGENT_STATION_LOGIN_FAILED": "AgentStationLoginFailed",
    "AGENT_STATE_CHANGE": "AgentStateChange",
    "AGENT_MULTI_LOGIN": "AGENT_MULTI_LOGIN",
    "AGENT_STATE_CHANGE_SUCCESS": "AgentStateChangeSuccess",
    "AGENT_STATE_CHANGE_FAILED": "AgentStateChangeFailed",
    "AGENT_BUDDY_AGENTS": "BuddyAgents",
    "AGENT_BUDDY_AGENTS_SUCCESS": "BuddyAgents",
    "AGENT_BUDDY_AGENTS_RETRIEVE_FAILED": "BuddyAgentsRetrieveFailed",
    "AGENT_CONTACT_RESERVED": "AgentContactReserved",
    "WELLNESS_BREAK": "WellnessBreak"
  },
  "CC_TASK_EVENTS": {
    "AGENT_CONTACT_ASSIGN_FAILED": "AgentContactAssignFailed",
    "AGENT_CONTACT_OFFER_RONA": "AgentOfferContactRona",
    "AGENT_CONTACT_HELD": "AgentContactHeld",
    "AGENT_CONTACT_HOLD_FAILED": "AgentContactHoldFailed",
    "AGENT_CONTACT_UNHELD": "AgentContactUnheld",
    "AGENT_CONTACT_UNHOLD_FAILED": "AgentContactUnHoldFailed",
    "AGENT_CONSULT_CREATED": "AgentConsultCreated",
    "AGENT_OFFER_CONSULT": "AgentOfferConsult",
    "AGENT_CONSULTING": "AgentConsulting",
    "AGENT_CONSULT_FAILED": "AgentConsultFailed",
    "AGENT_CTQ_FAILED": "AgentCtqFailed",
    "AGENT_CTQ_CANCELLED": "AgentCtqCancelled",
    "AGENT_CTQ_CANCEL_FAILED": "AgentCtqCancelFailed",
    "AGENT_CONSULT_ENDED": "AgentConsultEnded",
    "AGENT_CONSULT_END_FAILED": "AgentConsultEndFailed",
    "AGENT_CONSULT_CONFERENCE_ENDED": "AgentConsultConferenceEnded",
    "AGENT_CONSULT_CONFERENCING": "AgentConsultConferencing",
    "AGENT_CONSULT_CONFERENCED": "AgentConsultConferenced",
    "AGENT_CONSULT_CONFERENCE_FAILED": "AgentConsultConferenceFailed",
    "PARTICIPANT_JOINED_CONFERENCE": "ParticipantJoinedConference",
    "PARTICIPANT_LEFT_CONFERENCE": "ParticipantLeftConference",
    "PARTICIPANT_LEFT_CONFERENCE_FAILED": "ParticipantLeftConferenceFailed",
    "PARTICIPANT_DROP_CONFERENCE_FAILED": "ParticipantDropConferenceFailed",
    "AGENT_CONSULT_CONFERENCE_END_FAILED": "AgentConsultConferenceEndFailed",
    "AGENT_CONFERENCE_TRANSFERRED": "AgentConferenceTransferred",
    "AGENT_CONFERENCE_TRANSFER_FAILED": "AgentConferenceTransferFailed",
    "PARTICIPANT_POST_CALL_ACTIVITY": "ParticipantPostCallActivity",
    "CONSULTED_PARTICIPANT_MOVING": "ConsultedParticipantMoving",
    "AGENT_BLIND_TRANSFERRED": "AgentBlindTransferred",
    "AGENT_BLIND_TRANSFER_FAILED": "AgentBlindTransferFailed",
    "AGENT_VTEAM_TRANSFERRED": "AgentVteamTransferred",
    "AGENT_VTEAM_TRANSFER_FAILED": "AgentVteamTransferFailed",
    "AGENT_CONSULT_TRANSFERRING": "AgentConsultTransferring",
    "AGENT_CONSULT_TRANSFERRED": "AgentConsultTransferred",
    "AGENT_CONSULT_TRANSFER_FAILED": "AgentConsultTransferFailed",
    "CONTACT_RECORDING_PAUSED": "ContactRecordingPaused",
    "CONTACT_RECORDING_STARTED": "ContactRecordingStarted",
    "CONTACT_RECORDING_PAUSE_FAILED": "ContactRecordingPauseFailed",
    "CONTACT_RECORDING_RESUMED": "ContactRecordingResumed",
    "CONTACT_RECORDING_RESUME_FAILED": "ContactRecordingResumeFailed",
    "CONTACT_ENDED": "ContactEnded",
    "CONTACT_MERGED": "ContactMerged",
    "CONTACT_UPDATED": "ContactUpdated",
    "CONTACT_OWNER_CHANGED": "ContactOwnerChanged",
    "AGENT_CONTACT_END_FAILED": "AgentContactEndFailed",
    "AGENT_WRAPUP": "AgentWrapup",
    "AGENT_WRAPPEDUP": "AgentWrappedUp",
    "AGENT_WRAPUP_FAILED": "AgentWrapupFailed",
    "AGENT_OUTBOUND_FAILED": "AgentOutboundFailed",
    "AGENT_CONTACT": "AgentContact",
    "AGENT_OFFER_CONTACT": "AgentOfferContact",
    "AGENT_CONTACT_ASSIGNED": "AgentContactAssigned",
    "AGENT_CONTACT_UNASSIGNED": "AgentContactUnassigned",
    "AGENT_INVITE_FAILED": "AgentInviteFailed",
    "AGENT_OFFER_CAMPAIGN_RESERVATION": "AgentOfferCampaignReservation",
    "CAMPAIGN_CONTACT_UPDATED": "CampaignContactUpdated",
    "CAMPAIGN_PREVIEW_ACCEPT_FAILED": "CampaignPreviewAcceptFailed",
    "CAMPAIGN_PREVIEW_SKIP_FAILED": "CampaignPreviewSkipFailed",
    "CAMPAIGN_PREVIEW_REMOVE_FAILED": "CampaignPreviewRemoveFailed",
    "REAL_TIME_TRANSCRIPTION": "REAL_TIME_TRANSCRIPTION",
    "SUGGESTED_RESPONSE": "SUGGESTED_RESPONSE",
    "SUGGESTED_RESPONSE_ACKNOWLEDGE": "SUGGESTED_RESPONSE_ACKNOWLEDGE",
    "POST_CALL_SUMMARY": "POST_CALL_SUMMARY",
    "MID_CALL_SUMMARY": "MID_CALL_SUMMARY",
    "FEATURE_ENABLEMENT": "FEATURE_ENABLEMENT",
    "MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT": "MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT"
  }
} as const;

const INTERNAL_ROOT_EXPORTS = Object.freeze([
  'SYSTEM_EVENTS',
  'SystemRegionSwitch',
  'ConnectionRecoveryFailureKind',
  'ConnectionRecoveryError',
  'RecoveryFailure',
  'TaskRecoveryGuard',
  'AIAssistantEventName',
  'AISummaryTimeoutCodeByInboundType',
  'AI_SUMMARY_DURATION_MS',
  'AI_SUMMARY_REQUEST_CANCELLED',
  'AI_ASSISTANT_CLIENT_TYPE',
]);

const EXPECTED_AI_SUMMARY_ERROR_CODES = Object.freeze([
  ['POST_CALL_SUMMARY_DISABLED', 'POST_CALL_SUMMARY_DISABLED'],
  ['MID_CALL_SUMMARY_DISABLED', 'MID_CALL_SUMMARY_DISABLED'],
  ['AI_ASSISTANT_BASE_URL_NOT_AVAILABLE', 'AI_ASSISTANT_BASE_URL_NOT_AVAILABLE'],
  ['POST_CALL_SUMMARY_TIMEOUT', 'POST_CALL_SUMMARY_TIMEOUT'],
  ['MID_CALL_SUMMARY_TIMEOUT', 'MID_CALL_SUMMARY_TIMEOUT'],
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
  CC_TASK_EVENTS: Object.freeze({
    REAL_TIME_TRANSCRIPTION: 'REAL_TIME_TRANSCRIPTION',
    SUGGESTED_RESPONSE: 'SUGGESTED_RESPONSE',
    SUGGESTED_RESPONSE_ACKNOWLEDGE: 'SUGGESTED_RESPONSE_ACKNOWLEDGE',
    POST_CALL_SUMMARY: 'POST_CALL_SUMMARY',
    MID_CALL_SUMMARY: 'MID_CALL_SUMMARY',
    FEATURE_ENABLEMENT: 'FEATURE_ENABLEMENT',
    MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT: 'MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT',
  }),
});

const MISSING_EXPORT_DIAGNOSTIC_CODES = Object.freeze([2305, 2614, 2724]);

const VALID_PUBLIC_CONTRACT_FIXTURE = `
import {
  AI_SUMMARY_ERROR_CODES,
  CC_TASK_EVENTS,
  TASK_EVENTS,
} from '../../../src';
import type {
  AISummaryAction,
  AISummaryFeedback,
  AISummaryResponse,
  AISummaryFeatureEnablement,
  ITask,
} from '../../../src';

const action: AISummaryAction = 'CONSULT';
const transferAction: AISummaryAction = 'TRANSFER';
const feedback: AISummaryFeedback = 'thumbs_down';
const postCallEnabledTrue: AISummaryFeatureEnablement = {
  interactionId: 'post-call-true',
  postCallEnabled: true,
};
const postCallEnabledFalse: AISummaryFeatureEnablement = {
  interactionId: 'post-call-false',
  postCallEnabled: false,
};
const postCallEnabledOmitted: AISummaryFeatureEnablement = {
  interactionId: 'post-call-omitted',
  midCallEnabled: true,
};
const midCallEnabledTrue: AISummaryFeatureEnablement = {
  interactionId: 'mid-call-true',
  midCallEnabled: true,
};
const midCallEnabledFalse: AISummaryFeatureEnablement = {
  interactionId: 'mid-call-false',
  midCallEnabled: false,
};
const midCallEnabledOmitted: AISummaryFeatureEnablement = {
  interactionId: 'mid-call-omitted',
  postCallEnabled: true,
};

const structuredPostCall: AISummaryResponse = {
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
};
const textPostCall: AISummaryResponse = {
  summary: 'plain post call summary',
  feedback: 'thumbs_up',
  state: 'IGNORED',
  wrapUpCode: 'ignored',
  numberOfTimesViewed: 2,
  numberOfTimesEdited: 1,
  numberOfTimesCopied: 1,
};
const noPostCallSummary: AISummaryResponse = {
  summary: '',
  feedback: 'none',
  state: 'NOT_RECEIVED',
  wrapUpCode: 'not-received',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
};

const structuredMidCall: AISummaryResponse = {
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
};
const textMidCall: AISummaryResponse = {
  summaryReceived: true,
  summary: 'plain mid call summary',
  feedback: 'thumbs_up',
  state: 'MID_CALL_CANCELLED',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
};
const unavailableMidCall: AISummaryResponse = {
  summaryReceived: false,
  summary: '',
  feedback: 'thumbs_down',
  state: 'NOT_RECEIVED',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
};
const cancelledMidCall: AISummaryResponse = {
  summaryReceived: false,
  summary: '',
  feedback: 'none',
  state: 'MID_CALL_CANCELLED',
  numberOfTimesViewed: 0,
  numberOfTimesEdited: 0,
  numberOfTimesCopied: 0,
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
    const selectedAction: AISummaryAction = requestedAction;
    void selectedAction;
    return {conversationId: 'conversation-1'};
  },
  sendMidCallSummaryResponse: async (payload, requestedAction) => {
    const selectedAction: AISummaryAction = requestedAction;
    const responseState = payload.state;
    void selectedAction;
    void responseState;
  },
};

const inboundPost = CC_TASK_EVENTS.POST_CALL_SUMMARY;
const receivingEvent = TASK_EVENTS.TASK_MID_CALL_SUMMARY_RECEIVED;
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
  type AISummaryAction,
  type AISummaryResponse,
  type AISummaryFeatureEnablement,
} from '../../../src';

let invalidAction: AISummaryAction;
// @ts-expect-error invalid summary action type must not widen
invalidAction = 'WRAP_UP';
void invalidAction;

// @ts-expect-error postCallEnabled must stay boolean; string values must not satisfy the public flag contract
const invalidPostCallEnabledString: AISummaryFeatureEnablement = {interactionId: 'interaction-1', postCallEnabled: 'true'};
void invalidPostCallEnabledString;

// @ts-expect-error postCallEnabled must stay boolean; number values must not satisfy the public flag contract
const invalidPostCallEnabledNumber: AISummaryFeatureEnablement = {interactionId: 'interaction-2', postCallEnabled: 1};
void invalidPostCallEnabledNumber;

// @ts-expect-error midCallEnabled must stay boolean; string values must not satisfy the public flag contract
const invalidMidCallEnabledString: AISummaryFeatureEnablement = {interactionId: 'interaction-3', midCallEnabled: 'false'};
void invalidMidCallEnabledString;

// @ts-expect-error midCallEnabled must stay boolean; number values must not satisfy the public flag contract
const invalidMidCallEnabledNumber: AISummaryFeatureEnablement = {interactionId: 'interaction-4', midCallEnabled: 0};
void invalidMidCallEnabledNumber;

// @ts-expect-error invalid summary feedback must not be accepted
const invalidFeedback: AISummaryResponse = {summary: 'x', feedback: 'ok', state: 'DEFAULT', wrapUpCode: 'wrap', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidFeedback;

// @ts-expect-error summaryReceived must stay boolean when supplied
const invalidDiscriminator: AISummaryResponse = {summaryReceived: 'true', summary: 'x', feedback: 'none', state: 'DEFAULT', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidDiscriminator;

// @ts-expect-error unknown summary states must not be accepted
const invalidSummaryState: AISummaryResponse = {summaryReceived: true, summary: 'x', feedback: 'none', state: 'POST_CALL_ONLY', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0};
void invalidSummaryState;

// @ts-expect-error actionTimeStamp is transport metadata generated by the SDK
const invalidActionTimestamp: AISummaryResponse = {summary: 'x', feedback: 'none', state: 'DEFAULT', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0, actionTimeStamp: 100};
void invalidActionTimestamp;

// @ts-expect-error publishTimestamp is transport metadata generated by the SDK
const invalidPublishTimestamp: AISummaryResponse = {summary: 'x', feedback: 'none', state: 'DEFAULT', numberOfTimesViewed: 1, numberOfTimesEdited: 0, numberOfTimesCopied: 0, publishTimestamp: 100};
void invalidPublishTimestamp;
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
  return getModuleExportSymbol(program, INDEX_PATH, exportName);
};

const getModuleExportSymbol = (
  program: ts.Program,
  modulePath: string,
  exportName: string
) => {
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(modulePath);
  if (!sourceFile) {
    throw new Error(`Missing source file ${modulePath}`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    throw new Error(`Unable to resolve module symbol ${modulePath}`);
  }

  const exportSymbol = checker
    .getExportsOfModule(moduleSymbol)
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

const resolveSymbol = (checker: ts.TypeChecker, symbol: ts.Symbol | undefined) => {
  if (!symbol) return undefined;

  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
};

describe('contact-center root public contract', () => {
  it('T-013 retains the module recovery failure type referenced by emitted Utils declarations', () => {
    const sourceProgram = createProgram();
    const program = ts.createProgram(sourceProgram.getRootFileNames(), {
      ...sourceProgram.getCompilerOptions(), noEmit: false, declaration: true, emitDeclarationOnly: true,
    });
    const outputs = new Map<string, string>();
    const result = program.emit(undefined, (file, content) => outputs.set(file.replace(/\\/g, '/'), content));
    expect(result.emitSkipped).toBe(false);
    expect(result.diagnostics).toEqual([]);
    const coreTypes = [...outputs].find(([file]) => file.endsWith('/services/core/types.d.ts'))?.[1];
    const utils = [...outputs].find(([file]) => file.endsWith('/services/core/Utils.d.ts'))?.[1];
    expect(coreTypes).toMatch(/export declare?\s*type RecoveryFailure|export type RecoveryFailure/);
    expect(utils).toBeDefined();
    const utilsDeclaration = ts.createSourceFile('Utils.d.ts', utils!, ts.ScriptTarget.Latest, true);
    const failureImport = utilsDeclaration.statements.find((statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === './types'
    );
    expect(failureImport?.importClause?.isTypeOnly).toBe(true);
    const bindings = failureImport?.importClause?.namedBindings;
    expect(bindings && ts.isNamedImports(bindings)).toBe(true);
    const recoveryFailure = (bindings as ts.NamedImports).elements.find(
      element => (element.propertyName ?? element.name).text === 'RecoveryFailure'
    );
    expect(recoveryFailure).toBeDefined();
    const normalize = utilsDeclaration.statements.filter(ts.isVariableStatement)
      .flatMap(statement => [...statement.declarationList.declarations])
      .find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'normalizeRecoveryFailure');
    expect(normalize?.type && ts.isFunctionTypeNode(normalize.type)).toBe(true);
    const returnType = (normalize!.type as ts.FunctionTypeNode).type;
    expect(ts.isTypeReferenceNode(returnType)).toBe(true);
    expect((returnType as ts.TypeReferenceNode).typeName.getText(utilsDeclaration)).toBe(recoveryFailure!.name.text);
    expect(getRootExportNames(sourceProgram)).not.toContain('RecoveryFailure');
  });

  it('T-013 oldPublicSignaturesVoiceControls', () => {
    const fixture = path.join(CONTACT_CENTER_ROOT, 'test/unit/spec/__legacy_voice_controls.ts');
    const program = createProgram({[fixture]: `
      import {VOICE_CONNECTION_STATUS, VoiceLineStatus, VoiceMobiusSocketStatus} from '../../../src';
      import type {
        ContactCenter, IContactCenter, Profile, StationLoginSuccessResponse, LogoutSuccess,
        StateChangeSuccess, StationLoginResponse, StationLogoutResponse, SetStateResponse,
        VoiceConnectionState, TaskUIControls, InteractionUIControls, TaskUIControlState, TaskUILeg, ITask,
      } from '../../../src';
      type Assert<T extends true> = T;
      type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends
        (<T>() => T extends B ? 1 : 2) ? true : false;
      type RegisterArgs = Assert<Exact<Parameters<ContactCenter['register']>, []>>;
      type RegisterReturn = Assert<Exact<ReturnType<ContactCenter['register']>, Promise<Profile>>>;
      type DeregisterArgs = Assert<Exact<Parameters<ContactCenter['deregister']>, []>>;
      type DeregisterReturn = Assert<Exact<ReturnType<ContactCenter['deregister']>, Promise<void>>>;
      type LoginArgs = Assert<Exact<Parameters<ContactCenter['stationLogin']>, [data: {
        teamId: string; loginOption: 'AGENT_DN' | 'EXTENSION' | 'BROWSER'; dialNumber?: string;
      }]>>;
      type LoginReturn = Assert<Exact<ReturnType<ContactCenter['stationLogin']>, Promise<StationLoginSuccessResponse | Error>>>;
      type LogoutArgs = Assert<Exact<Parameters<ContactCenter['stationLogout']>, [data: {
        logoutReason?: 'User requested logout' | 'Inactivity Logout' | 'User requested agent profile update';
      }]>>;
      type LogoutReturn = Assert<Exact<ReturnType<ContactCenter['stationLogout']>, Promise<LogoutSuccess | Error>>>;
      type StateArgs = Assert<Exact<Parameters<ContactCenter['setAgentState']>, [data: {
        state: string; auxCodeId: string; lastStateChangeReason?: string; agentId?: string;
      }]>>;
      type StateReturn = Assert<Exact<ReturnType<ContactCenter['setAgentState']>, Promise<StateChangeSuccess | Error>>>;
      type VoiceArgs = Assert<Exact<Parameters<ContactCenter['getVoiceConnectionState']>, []>>;
      type VoiceReturn = Assert<Exact<ReturnType<ContactCenter['getVoiceConnectionState']>, VoiceConnectionState>>;
      type InterfaceRegister = Assert<Exact<IContactCenter['register'], () => Promise<Profile>>>;
      type InterfaceVoice = Assert<Exact<IContactCenter['getVoiceConnectionState'], () => VoiceConnectionState>>;
      type Voice = Assert<Exact<VoiceConnectionState, {
        status: VOICE_CONNECTION_STATUS; lineStatus: VoiceLineStatus;
        mobiusSocketStatus: VoiceMobiusSocketStatus; reason?: string; retryable?: boolean;
      }>>;
      type VoiceStatuses = Assert<Exact<\`\${VOICE_CONNECTION_STATUS}\`, 'ready' | 'unavailable' | 'not-required'>>;
      type LineStatuses = Assert<Exact<\`\${VoiceLineStatus}\`, 'unknown' | 'connecting' | 'registered' | 'reconnecting' | 'reconnected' | 'unregistered' | 'error'>>;
      type SocketStatuses = Assert<Exact<\`\${VoiceMobiusSocketStatus}\`, 'unknown' | 'not-in-use' | 'connected' | 'disconnected'>>;
      type Control = {isVisible: boolean; isEnabled: boolean};
      type Leg = {
        accept: Control; decline: Control; hold: Control; transfer: Control; consult: Control;
        end: Control; recording: Control; mute: Control; consultTransfer: Control; endConsult: Control;
        conference: Control; exitConference: Control; transferConference: Control;
        mergeToConference: Control; wrapup: Control; switch: Control; keypad?: Control;
      };
      type ControlContract = Assert<Exact<TaskUIControlState, Control>>;
      type LegContract = Assert<Exact<InteractionUIControls, Leg>>;
      type ActiveLeg = Assert<Exact<TaskUILeg, 'main' | 'consult'>>;
      type Controls = Assert<Exact<TaskUIControls, {
        main: Leg; consult: Leg; activeLeg: 'main' | 'consult';
        consultTransferDestinations: {consult: string[]; transfer: string[]};
      }>>;
      type TaskControls = Assert<Exact<ITask['uiControls'], TaskUIControls>>;
      declare const cc: ContactCenter;
      declare const task: ITask;
      // Existing host expressions keep their Promise and synchronous snapshot boundaries.
      const registered: Promise<Profile> = cc.register();
      const deregistered: Promise<void> = cc.deregister();
      const loggedIn: Promise<StationLoginResponse> = cc.stationLogin({teamId: 'team', loginOption: 'BROWSER'});
      cc.stationLogin({teamId: 'team', loginOption: 'EXTENSION', dialNumber: '1234'});
      const loggedOut: Promise<StationLogoutResponse> = cc.stationLogout({});
      cc.stationLogout({logoutReason: 'User requested logout'});
      const changed: Promise<SetStateResponse> = cc.setAgentState({state: 'Available', auxCodeId: '0'});
      cc.setAgentState({state: 'Idle', auxCodeId: 'break', agentId: 'agent', lastStateChangeReason: 'manual'});
      const voice: VoiceConnectionState = cc.getVoiceConnectionState();
      const enabled: boolean = task.uiControls[task.uiControls.activeLeg].hold.isEnabled;
      const keypad: boolean | undefined = task.uiControls.main.keypad?.isVisible;
      const destinations: string[] = task.uiControls.consultTransferDestinations.transfer;
      // @ts-expect-error registration has no public options argument
      cc.register({signal: new AbortController().signal});
      // @ts-expect-error deregistration has no public options argument
      cc.deregister(true);
      // @ts-expect-error login still requires its payload
      cc.stationLogin();
      // @ts-expect-error login still requires a team
      cc.stationLogin({loginOption: 'BROWSER'});
      // @ts-expect-error logout still requires its payload even though the reason is optional
      cc.stationLogout();
      // @ts-expect-error logout reason remains a fixed vocabulary
      cc.stationLogout({logoutReason: 'arbitrary'});
      // @ts-expect-error state change still requires an auxiliary code
      cc.setAgentState({state: 'Available'});
      // @ts-expect-error voice getter remains synchronous
      const asyncVoice: Promise<VoiceConnectionState> = cc.getVoiceConnectionState();
      // @ts-expect-error voice getter has no public options argument
      cc.getVoiceConnectionState({});
      // @ts-expect-error underlying line state remains required
      const incompleteVoice: VoiceConnectionState = {status: VOICE_CONNECTION_STATUS.READY, mobiusSocketStatus: VoiceMobiusSocketStatus.CONNECTED};
      // @ts-expect-error controls keep per-leg ownership
      task.uiControls.hold.isEnabled;
      // @ts-expect-error active leg is closed
      const invalidLeg: TaskUILeg = 'other';
      // @ts-expect-error a control requires both flags
      const invalidControl: TaskUIControlState = {isEnabled: true};
      // @ts-expect-error controls retain both interaction legs
      const incompleteControls: TaskUIControls = {main: task.uiControls.main, activeLeg: 'main', consultTransferDestinations: {consult: [], transfer: []}};
      void [registered, deregistered, loggedIn, loggedOut, changed, voice, enabled, keypad, destinations];
    `});
    expect(getDiagnosticsForFiles(program, [fixture]).map(diagnostic =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )).toEqual([]);
  });

  it('T-013 publicCcEventsKeysUnchanged', () => {
    const fixture = path.join(CONTACT_CENTER_ROOT, 'test/unit/spec/__recovery_event_union.ts');
    const expectedValues = Object.values(EXPECTED_CC_EVENT_CATALOGS).flatMap(Object.values);
    const program = createProgram({[fixture]: `
      import type {ContactCenterEvents} from '../../../src';
      type Expected = ${[...new Set(expectedValues)].map((value) => JSON.stringify(value)).join(' | ')};
      type Assert<T extends true> = T;
      type Exact = Assert<[ContactCenterEvents] extends [Expected] ? [Expected] extends [ContactCenterEvents] ? true : false : false>;
    `});

    Object.entries(EXPECTED_CC_EVENT_CATALOGS).forEach(([name, entries]) => {
      expect(entriesToObject(getStringLiteralObjectEntries(
        getObjectLiteralInitializer(getRootExportSymbol(program, name), name)
      ))).toEqual(entries);
    });
    const checker = program.getTypeChecker();
    const combined = getRootExportSymbol(program, 'CC_EVENTS');
    const actual = checker.getTypeOfSymbolAtLocation(combined, combined.valueDeclaration!);
    const entries = actual.getProperties().map((property) => [
      property.name,
      (checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration!) as ts.StringLiteralType).value,
    ]);
    expect(entriesToObject(entries)).toEqual({...EXPECTED_CC_EVENT_CATALOGS.CC_AGENT_EVENTS, ...EXPECTED_CC_EVENT_CATALOGS.CC_TASK_EVENTS});
    expect(getDiagnosticsForFiles(program, [fixture])).toEqual([]);
  });

  it('T-007 root routingAgent preserves the state payload, callback and context types', () => {
    const fixture = path.join(CONTACT_CENTER_ROOT, 'test/unit/spec/__state_id_consumer.ts');
    const program = createProgram({[fixture]: `
      import {routingAgent} from '../../../src';
      import type {StateChangeSuccess} from '../../../src';
      declare const agent: ReturnType<typeof routingAgent>;
      const data = {state: 'Available', auxCodeId: '0'};
      const callback = (response: any): void => {};
      const context = {generation: 3, signal: new AbortController().signal};
      const legacy: Promise<StateChangeSuccess> = agent.stateChange({data});
      const withCallback: Promise<StateChangeSuccess> = agent.stateChange({data}, callback);
      const withContext: Promise<StateChangeSuccess> = agent.stateChange({data}, undefined, context);
      const withBoth: Promise<StateChangeSuccess> = agent.stateChange({data}, callback, context);
      // @ts-expect-error SDK correlation is owned by its request context.
      agent.stateChange({data, requestId: '8f5ec5e4-80b8-4f5d-9720-10bfe56e7ca1'});
      // @ts-expect-error state changes still require their payload.
      agent.stateChange({});
      // @ts-expect-error context still requires an explicit generation.
      agent.stateChange({data}, callback, {signal: context.signal});
    `});
    expect(getDiagnosticsForFiles(program, [fixture]).map(diagnostic =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )).toEqual([]);
  });

  it('T-013 docContractLinksAndExactHostExample API links', () => {
    const readme = fs.readFileSync(path.join(CONTACT_CENTER_ROOT, 'README.md'), 'utf8');
    const guide = fs.readFileSync(path.join(CONTACT_CENTER_ROOT, 'docs/getting-started.md'), 'utf8');
    expect(readme).toContain('docs/getting-started.md#multi-region-recovery-host-restart');
    expect(readme).not.toContain('decideRegionRestart');
    expect(guide.split('<!-- region-recovery-host-example:start -->')).toHaveLength(2);
    for (const contract of ['RegionRecoveryState', 'RegionRecoveryStatus', 'RegionRecoveryReason', 'RegionAutoAvailableStatus', 'RegionRecoveryErrorCode', 'REL-AQM-TRACKING-ECHO']) expect(guide).toContain(contract);
  });

  it('T-013 additiveRecoveryExportsAndTypedConsumer / plainErrorCatalogRoundTrip typed narrowing', () => {
    const fixture = path.join(CONTACT_CENTER_ROOT, 'test/unit/spec/__recovery_consumer.ts');
    const program = createProgram({[fixture]: `
      import {REGION_RECOVERY_EVENTS, REGION_RECOVERY_ERROR_CODES} from '../../../src';
      import type {RegionRecoveryState, RegionRecoveryStatus, RegionRecoveryReason, RegionAutoAvailableStatus, RegionRecoveryErrorCode} from '../../../src';
      import {isRegionRecoveryError, createRegionRecoveryError} from '../../../src/services/core/Utils';
      type Assert<T extends true> = T;
      type Exact<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
      type Status = Assert<Exact<RegionRecoveryStatus, 'recovering' | 'ready' | 'reloadRequired' | 'stationLoginRequired' | 'unavailable'>>;
      type Reason = Assert<Exact<RegionRecoveryReason, 'initial-login' | 'region-switch' | 'region-mismatch' | 'not-eligible' | 'session-restore-failed' | 'automatic-relogin-disabled' | 'authentication-failed' | 'recovery-failed'>>;
      type Auto = Assert<Exact<RegionAutoAvailableStatus, 'waitingForVoice' | 'requesting' | 'succeeded' | 'failed' | 'cancelled'>>;
      type Codes = Assert<Exact<RegionRecoveryErrorCode, 'RECOVERY_INTERRUPTED' | 'RECOVERY_IN_PROGRESS' | 'STALE_TASK' | 'REGION_RELOAD_REQUIRED'>>;
      const event: 'region:stateChange' = REGION_RECOVERY_EVENTS.STATE_CHANGE;
      const state: RegionRecoveryState = {status: 'ready', reason: 'region-switch', operation: 'FAILOVER', scope: 'ORG', limitedService: false, retryAfterMs: 0, autoAvailable: 'requesting'};
      const created: RegionRecoveryErrorCode = createRegionRecoveryError(REGION_RECOVERY_ERROR_CODES.STALE_TASK).data.reason;
      declare const candidate: unknown;
      if (isRegionRecoveryError(candidate)) {
        const error: Error = candidate;
        const reason: RegionRecoveryErrorCode = candidate.data.reason;
        void [error, reason];
      }
      // @ts-expect-error no extra lifecycle codes
      const invalid: RegionRecoveryErrorCode = 'INVALID_MR_SETTINGS';
      // @ts-expect-error recovering is not an automatic action outcome
      const invalidAuto: RegionAutoAvailableStatus = 'recovering';
      void [event, state, created, invalid, invalidAuto];
    `});
    const catalogs = {
      REGION_RECOVERY_EVENTS: {STATE_CHANGE: 'region:stateChange'},
      REGION_RECOVERY_ERROR_CODES: {
        RECOVERY_INTERRUPTED: 'RECOVERY_INTERRUPTED',
        RECOVERY_IN_PROGRESS: 'RECOVERY_IN_PROGRESS',
        STALE_TASK: 'STALE_TASK',
        REGION_RELOAD_REQUIRED: 'REGION_RELOAD_REQUIRED',
      },
    };
    Object.entries(catalogs).forEach(([name, expected]) => {
      expect(entriesToObject(getStringLiteralObjectEntries(
        getObjectLiteralInitializer(getRootExportSymbol(program, name), name)
      ))).toEqual(expected);
    });
    expect(getDiagnosticsForFiles(program, [fixture])).toEqual([]);
    const types = program.getSourceFile(TYPES_PATH)!;
    const catalogImport = types.statements.find((statement) =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === './services/core/constants'
    ) as ts.ImportDeclaration;
    expect(catalogImport.importClause?.isTypeOnly).toBe(true);
    const leaf = program.getSourceFile(path.join(SRC_ROOT, 'services/core/constants.ts'))!;
    expect(leaf.statements.some(ts.isImportDeclaration)).toBe(false);
  });

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
          getModuleExportSymbol(program, TYPES_PATH, 'AIAssistantEventName'),
          'AIAssistantEventName'
        ),
        Object.keys(EXPECTED_AI_SUMMARY_WIRE_LITERALS.AIAssistantEventName),
        'AIAssistantEventName'
      )
    );
    const ccAISummaryEventLiterals = entriesToObject(
      getNamedStringLiteralObjectEntries(
        getObjectLiteralInitializer(
          getRootExportSymbol(program, 'CC_TASK_EVENTS'),
          'CC_TASK_EVENTS'
        ),
        Object.keys(EXPECTED_AI_SUMMARY_WIRE_LITERALS.CC_TASK_EVENTS),
        'CC_TASK_EVENTS'
      )
    );

    expect({
      AIAssistantEventName: aiAssistantEventNameLiterals,
      CC_TASK_EVENTS: ccAISummaryEventLiterals,
    }).toEqual(EXPECTED_AI_SUMMARY_WIRE_LITERALS);
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
