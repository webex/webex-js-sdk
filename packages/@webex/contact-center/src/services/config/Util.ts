import {LOST_CONNECTION_RECOVERY_TIMEOUT} from '../core/constants';
import {WELLNESS_BREAK_REMINDERS_ENABLED} from './constants';
import {
  AgentProfile,
  AgentResponse,
  AuxCode,
  AuxCodeType,
  DialPlanEntity,
  Entity,
  IDLE_CODE,
  OrgDesktopLoginResponse,
  Profile,
  TeamList,
  MicrosoftConfig,
  WebexConfig,
  WRAP_UP_CODE,
} from './types';

/**
 * Get the MSFT configuration
 * @param {MicrosoftConfig} microsoftConfig
 * @returns {Object}
 */
const getMsftConfig = (microsoftConfig?: MicrosoftConfig) => {
  return {
    showUserDetailsMS: microsoftConfig?.showUserDetails ?? false,
    stateSynchronizationMS: microsoftConfig?.stateSynchronization ?? false,
  };
};

/**
 * Get the Webex configuration
 * @param {WebexConfig} webexConfig
 * @returns {Object}
 */
const getWebexConfig = (webexConfig?: WebexConfig) => {
  return {
    showUserDetailsWebex: webexConfig?.showUserDetails ?? false,
    stateSynchronizationWebex: webexConfig?.stateSynchronization ?? false,
  };
};

/**
 * Get the default agent DN
 * @param {string} agentDNValidation
 * @returns {boolean}
 */
const getDefaultAgentDN = (agentDNValidation: string) => {
  return agentDNValidation === 'PROVISIONED_VALUE';
};

/**
 * Get the dialplan entries for every active plan in the organization.
 * The desktop-login aggregate does not carry the per-profile `dialPlans` selection, so all active
 * plans apply.
 * @param {Array<DialPlanEntity>} dialPlanData
 * @returns {Array<Entity>}
 */
const getFilteredDialplanEntries = (dialPlanData: DialPlanEntity[]) => {
  const dialPlanEntries = [];
  dialPlanData.forEach((dailPlan: DialPlanEntity) => {
    if (dailPlan.active) {
      const filteredPlan = {
        regex: dailPlan.regularExpression,
        prefix: dailPlan.prefix,
        strippedChars: dailPlan.strippedChars,
        name: dailPlan.name,
      };
      dialPlanEntries.push(filteredPlan);
    }
  });

  return dialPlanEntries;
};

/**
 * Get the active aux codes of the given type.
 * The desktop-login aggregate does not carry the per-agent restriction lists, so the whole pool
 * returned by the aux-code API applies.
 * @param {Array<AuxCode>} auxCodes
 * @param {AuxCodeType} type
 * @returns {Array<Entity>}
 */
const getFilterAuxCodes = (auxCodes: Array<AuxCode>, type: AuxCodeType) => {
  const filteredAuxCodes: Array<Entity> = [];
  auxCodes.forEach((auxCode: AuxCode) => {
    if (auxCode.workTypeCode === type && auxCode.active) {
      filteredAuxCodes.push({
        id: auxCode.id,
        name: auxCode.name,
        isSystem: auxCode.isSystemCode,
        isDefault: auxCode.defaultCode,
      });
    }
  });

  return filteredAuxCodes;
};

/**
 * Get the default wrapup code
 * @param {Array<Entity>} wrapUpReasonList
 * @returns {Entity}
 */
function getDefaultWrapUpCode(wrapUpReasonList: Entity[]) {
  return wrapUpReasonList?.find((c: Entity) => c.isDefault);
}

/**
 * Parse the agent configurations
 * @param {Object} profileData
 * @returns {Profile}
 */
function parseAgentConfigs(profileData: {
  orgConfig: OrgDesktopLoginResponse;
  userData: AgentResponse;
  agentProfileData: AgentProfile;
  teamData: TeamList[];
  auxCodes: AuxCode[];
  dialPlanData: DialPlanEntity[];
  multimediaProfileId: string;
}): Profile {
  const {orgConfig, userData, agentProfileData, teamData, auxCodes, dialPlanData} = profileData;
  const {
    organization: orgInfoData,
    organizationSetting: orgSettingsData,
    tenantConfiguration: tenantData,
    urlMappings,
    aiFeature,
    microsoftConfig,
    webexConfig,
  } = orgConfig;

  const tenantDataTimeout = tenantData.timeoutDesktopInactivityEnabled
    ? tenantData.timeoutDesktopInactivityMins
    : null;
  const inactivityTimeoutTimer = agentProfileData.timeoutDesktopInactivityCustomEnabled
    ? agentProfileData.timeoutDesktopInactivityMins
    : tenantDataTimeout;

  const wrapupCodes = getFilterAuxCodes(auxCodes, WRAP_UP_CODE);

  const idleCodes = getFilterAuxCodes(auxCodes, IDLE_CODE);

  idleCodes.push({
    id: '0',
    name: 'Available',
    isSystem: false,
    isDefault: false,
  }); // pushing available state to idle codes

  const defaultWrapUpData = getDefaultWrapUpCode(wrapupCodes);
  const isWellnessConfigured =
    aiFeature?.agentWellbeing?.enable === true &&
    aiFeature.agentWellbeing.wellnessBreakReminders === WELLNESS_BREAK_REMINDERS_ENABLED;
  const hasAIAssistantLicense = (orgSettingsData.aiAssistantQuantity ?? 0) > 0;

  const finalData = {
    teams: teamData,
    defaultDn: userData.deafultDialledNumber,
    forceDefaultDn: tenantData.forceDefaultDn,
    forceDefaultDnForAgent: getDefaultAgentDN(agentProfileData.agentDNValidation),
    regexUS: tenantData.dnDefaultRegex,
    regexOther: tenantData.dnOtherRegex,
    agentId: userData.ciUserId,
    agentName: `${userData.firstName} ${userData.lastName}`,
    agentMailId: userData.email,
    agentProfileID: userData.agentProfileId,
    dialPlan: agentProfileData.dialPlanEnabled
      ? {
          type: 'adhocDial',
          dialPlanEntity: getFilteredDialplanEntries(dialPlanData),
        }
      : undefined,
    multimediaProfileId: profileData.multimediaProfileId,
    skillProfileId: userData.skillProfileId ? userData.skillProfileId : null,
    siteId: userData.siteId,
    enterpriseId: orgInfoData.tenantId,
    tenantTimezone: orgInfoData.timezone,
    privacyShieldVisible: tenantData.privacyShieldVisible,
    organizationIdleCodes: [], // TODO: for supervisor, getOrgFilteredIdleCodes(auxCodes, false),
    idleCodesAccess: agentProfileData.accessIdleCode as 'ALL' | 'SPECIFIC',
    idleCodes,
    wrapupCodes,
    wrapUpData: {
      wrapUpProps: {
        autoWrapup: agentProfileData.autoWrapUp,
        autoWrapupInterval: agentProfileData.autoWrapAfterSeconds,
        lastAgentRoute: agentProfileData.lastAgentRouting,
        wrapUpCodeAccess: agentProfileData.accessWrapUpCode,
        wrapUpReasonList: wrapupCodes,
        allowCancelAutoWrapup: agentProfileData.allowAutoWrapUpExtension,
      },
    },
    defaultWrapupCode: defaultWrapUpData?.id ?? '',
    isOutboundEnabledForTenant: tenantData.outdialEnabled,
    isOutboundEnabledForAgent: agentProfileData.outdialEnabled,
    isAdhocDialingEnabled: agentProfileData.dialPlanEnabled,
    isAgentAvailableAfterOutdial: agentProfileData.agentAvailableAfterOutdial,
    outDialEp: agentProfileData.outdialEntryPointId,
    isCampaignManagementEnabled: orgSettingsData.campaignManagerEnabled,
    isEndTaskEnabled: tenantData.endCallEnabled,
    isEndConsultEnabled: tenantData.endConsultEnabled,
    callVariablesSuppressed: tenantData.callVariablesSuppressed,
    agentDbId: userData.dbId,
    allowConsultToQueue: agentProfileData.consultToQueue,
    accessQueue: agentProfileData.accessQueue,
    accessEntryPoint: agentProfileData.accessEntryPoint,
    accessBuddyTeam: agentProfileData.accessBuddyTeam,
    agentPersonalStatsEnabled: agentProfileData.viewableStatistics
      ? agentProfileData.viewableStatistics.agentStats
      : false,
    addressBookId: agentProfileData.addressBookId,
    outdialANIId: agentProfileData.outdialANIId,
    analyserUserId: userData.id,

    urlMappings: {
      acqueonApiUrl: urlMappings?.ACQUEON_API_URL ?? '',
      acqueonConsoleUrl: urlMappings?.ACQUEON_CONSOLE_URL ?? '',
    },
    isTimeoutDesktopInactivityEnabled: tenantData.timeoutDesktopInactivityEnabled,
    timeoutDesktopInactivityMins: inactivityTimeoutTimer,
    loginVoiceOptions: agentProfileData.loginVoiceOptions ?? [],
    webRtcEnabled: orgSettingsData.webRtcEnabled,
    maskSensitiveData: orgSettingsData.maskSensitiveData
      ? orgSettingsData.maskSensitiveData
      : false,
    microsoftConfig: getMsftConfig(microsoftConfig),
    webexConfig: getWebexConfig(webexConfig),
    lostConnectionRecoveryTimeout:
      tenantData.lostConnectionRecoveryTimeout || LOST_CONNECTION_RECOVERY_TIMEOUT,
    aiFeature,
    isWellnessBreakEnabled: isWellnessConfigured && hasAIAssistantLicense,
  };

  return finalData;
}

export {parseAgentConfigs};
