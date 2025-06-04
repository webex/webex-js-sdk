import {registerPlugin} from '@webex/webex-core';
import config from './config';
import ContactCenter from './cc';

/** @module ContactCenterModule */

// Core exports
/**
 * ContactCenter is the main plugin class for Webex Contact Center integration
 * @category Core
 */
export {default as ContactCenter} from './cc';

// Service exports
/**
 * Task class represents a contact center task that can be managed by an agent
 * @category Services
 */
export {default as Task} from './services/task';

/**
 * Agent routing service for Contact Center operations
 * @category Services
 */
export {default as routingAgent} from './services/agent';

// Enums
/**
 * Task Events for Contact Center operations
 * @enum {string}
 * @category Enums
 */
export {TASK_EVENTS} from './services/task/types';
export type {TASK_EVENTS as TaskEvents} from './services/task/types';

/**
 * Agent Events for Contact Center operations
 * @enum {string}
 * @category Enums
 */
export {AGENT_EVENTS} from './services/agent/types';
export type {AGENT_EVENTS as AgentEvents} from './services/agent/types';

/**
 * Contact Center Task Events
 * @enum {string}
 * @category Enums
 */
export {CC_TASK_EVENTS} from './services/config/types';

/**
 * Contact Center Agent Events
 * @enum {string}
 * @category Enums
 */
export {CC_AGENT_EVENTS} from './services/config/types';

/**
 * Combined Contact Center Events
 * @enum {string}
 * @category Enums
 */
export {CC_EVENTS} from './services/config/types';
export type {CC_EVENTS as ContactCenterEvents} from './services/config/types';

// Interfaces
/** Main types and interfaces for Contact Center functionality */
export type {
  /** Interface for Contact Center plugin */
  IContactCenter,
  /** Configuration options for Contact Center plugin */
  CCPluginConfig,
  /** WebexSDK interface */
  WebexSDK,
} from './types';

// Types
/** Agent related types */
export type {
  /** Login options for agents */
  LoginOption,
  /** Agent login information */
  AgentLogin,
  /** Agent device update information */
  AgentProfileUpdate,
  /** Station login response */
  StationLoginResponse,
  /** Station logout response */
  StationLogoutResponse,
  /** Buddy agents response */
  BuddyAgentsResponse,
  /** Buddy agents information */
  BuddyAgents,
  /** Subscribe request parameters */
  SubscribeRequest,
  /** Upload logs response */
  UploadLogsResponse,
  /** Update device type response */
  UpdateDeviceTypeResponse,
  /** Generic error interface */
  GenericError,
  /** Set state response */
  SetStateResponse,
} from './types';

/** Task related types */
export type {
  AgentContact,
  /** Task interface */
  ITask,
  TaskData,
  /** Task response */
  TaskResponse,
  ConsultPayload,
  ConsultEndPayload,
  ConsultTransferPayLoad,
  /** Dialer payload */
  DialerPayload,
  TransferPayLoad,
  ResumeRecordingPayload,
  WrapupPayLoad,
} from './services/task/types';

/** Agent related types */
export type {
  /** State change interface */
  StateChange,
  /** Logout interface */
  Logout,
  /** State change success response */
  StateChangeSuccess,
  /** Station login success response */
  StationLoginSuccess,
  /** Extended station login success response with notification tracking */
  StationLoginSuccessResponse,
  /** Device type update success response */
  DeviceTypeUpdateSuccess,
  /** Agent login success response */
  LogoutSuccess,
  /** Agent relogin success response */
  ReloginSuccess,
  /** Agent state type */
  AgentState,
  /** User station login parameters */
  UserStationLogin,
  /** Device type for agent login */
  DeviceType,
  /** Buddy agent details */
  BuddyDetails,
  /** Buddy agents success response */
  BuddyAgentsSuccess,
} from './services/agent/types';

/** Config related types */
export type {
  /** Profile interface */
  Profile,
  /** Contact service queue interface */
  ContactServiceQueue,
  /** Response type from getUserUsingCI method */
  AgentResponse,
  /** Response from getDesktopProfileById */
  DesktopProfileResponse,
  /** Response from getMultimediaProfileById */
  MultimediaProfileResponse,
  /** Response from getListOfTeams */
  ListTeamsResponse,
  /** Response from getListOfAuxCodes */
  ListAuxCodesResponse,
  /** Response from getSiteInfo */
  SiteInfo,
  /** Response from getOrgInfo */
  OrgInfo,
  /** Response from getOrganizationSetting */
  OrgSettings,
  /** Response from getTenantData */
  TenantData,
  /** Response from getURLMapping */
  URLMapping,
  /** Response from getDialPlanData */
  DialPlanEntity,
  /** Auxiliary code information */
  AuxCode,
  /** Team information */
  TeamList,
  /** Wrap-up reason information */
  WrapUpReason,
  /** WebSocket event data */
  WebSocketEvent,
  /** Wrap-up configuration data */
  WrapupData,
  /** Base entity type */
  Entity,
  /** Dial plan configuration */
  DialPlan,
  /** Auxiliary code type (IDLE_CODE or WRAP_UP_CODE) */
  AuxCodeType,
} from './services/config/types';

// Constants
/**
 * Idle code constant
 * @constant {string}
 * @category Enums
 */
export {IDLE_CODE} from './services/config/types';

/**
 * Wrap up code constant
 * @constant {string}
 * @category Enums
 */
export {WRAP_UP_CODE} from './services/config/types';

registerPlugin('cc', ContactCenter, {
  config,
});

/** The Contact Center plugin default export */
export default ContactCenter;
