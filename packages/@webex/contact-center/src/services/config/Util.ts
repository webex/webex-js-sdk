import {LOST_CONNECTION_RECOVERY_TIMEOUT} from '../core/constants';
import {
  AgentResponse,
  AuxCode,
  AuxCodeType,
  DesktopProfileResponse,
  DialPlanEntity,
  Entity,
  IDLE_CODE,
  OrgInfo,
  OrgSettings,
  Profile,
  Team,
  TenantData,
  URLMapping,
  WRAP_UP_CODE,
} from './types';

/**
 * Get the URL mapping for the given name
 * @param {Array<URLMapping>} urlMappings
 * @param {string} name
 * @returns {string}
 */
const getUrlMapping = (urlMappings: Array<URLMapping>, name: string) => {
  const mappedUrl = urlMappings.find((mapping) => mapping.name === name)?.url;

  return mappedUrl || '';
};

/**
 * Get the MSFT and Webex configuration
 * @param {DesktopProfileResponse} agentProfileData
 * @returns {Object}
 */
const getMsftConfig = (agentProfileData: DesktopProfileResponse) => {
  return {
    showUserDetailsMS: agentProfileData.showUserDetailsMS ?? false,
    stateSynchronizationMS: agentProfileData.stateSynchronizationMS ?? false,
  };
};

/**
 * Get the Webex configuration
 * @param {DesktopProfileResponse} agentProfileData
 * @returns {Object}
 */
const getWebexConfig = (agentProfileData: DesktopProfileResponse) => {
  return {
    showUserDetailsWebex: agentProfileData.showUserDetailsWebex ?? false,
    stateSynchronizationWebex: agentProfileData.stateSynchronizationWebex ?? false,
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
 * Get the filtered dialplan entries
 * @param {Array<DialPlanEntity>} dialPlanData
 * @param {Array<string>} profileDialPlans
 * @returns {Array<Entity>}
 */
const getFilteredDialplanEntries = (dialPlanData: DialPlanEntity[], profileDialPlans: string[]) => {
  const dialPlanEntries = [];
  dialPlanData.forEach((dailPlan: DialPlanEntity) => {
    if (profileDialPlans.includes(dailPlan.id)) {
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
 * Get the filtered aux codes
 * @param {Array<AuxCode>} auxCodes
 * @param {AuxCodeType} type
 * @param {Array<string>} specificCodes
 * @returns {Array<Entity>}
 */
const getFilterAuxCodes = (
  auxCodes: Array<AuxCode>,
  type: AuxCodeType,
  specificCodes: string[]
) => {
  const filteredAuxCodes: Array<Entity> = [];
  auxCodes.forEach((auxCode: AuxCode) => {
    if (
      auxCode.workTypeCode === type &&
      auxCode.active &&
      (specificCodes.length === 0 || specificCodes.includes(auxCode.id))
    ) {
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
  userData: AgentResponse;
  teamData: Team[];
  tenantData: TenantData;
  orgInfoData: OrgInfo;
  auxCodes: AuxCode[];
  orgSettingsData: OrgSettings;
  agentProfileData: DesktopProfileResponse;
  dialPlanData: DialPlanEntity[];
  urlMapping: URLMapping[];
  multimediaProfileId: string;
}): Profile {
  const {
    userData,
    teamData,
    tenantData,
    orgInfoData,
    auxCodes,
    orgSettingsData,
    agentProfileData,
    dialPlanData,
    urlMapping,
  } = profileData;

  const tenantDataTimeout = tenantData.timeoutDesktopInactivityEnabled
    ? tenantData.timeoutDesktopInactivityMins
    : null;
  const inactivityTimeoutTimer = agentProfileData.timeoutDesktopInactivityCustomEnabled
    ? agentProfileData.timeoutDesktopInactivityMins
    : tenantDataTimeout;

  const wrapupCodes = getFilterAuxCodes(
    auxCodes,
    WRAP_UP_CODE,
    agentProfileData.accessWrapUpCode === 'ALL' ? [] : agentProfileData.wrapUpCodes
  );

  const idleCodes = getFilterAuxCodes(
    auxCodes,
    IDLE_CODE,
    agentProfileData.accessIdleCode === 'ALL' ? [] : agentProfileData.idleCodes
  );

  idleCodes.push({
    id: '0',
    name: 'Available',
    isSystem: false,
    isDefault: false,
  }); // pushing available state to idle codes

  const defaultWrapUpData = getDefaultWrapUpCode(wrapupCodes);

  const finalData = {
    teams: teamData,
    defaultDn: userData.defaultDialledNumber,
    forceDefaultDn: tenantData.forceDefaultDn,
    forceDefaultDnForAgent: getDefaultAgentDN(agentProfileData.agentDNValidation),
    regexUS: tenantData.dnDefaultRegex,
    regexOther: tenantData.dnOtherRegex,
    agentId: userData.ciUserId,
    agentName: `${userData.firstName} ${userData.lastName}`,
    agentMailId: userData.email,
    agentProfileID: userData.agentProfileId,
    autoAnswer: agentProfileData.autoAnswer,
    dialPlan: agentProfileData.dialPlanEnabled
      ? {
          type: 'adhocDial',
          dialPlanEntity: getFilteredDialplanEntries(dialPlanData, agentProfileData.dialPlans),
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
    isEndCallEnabled: tenantData.endCallEnabled,
    isEndConsultEnabled: tenantData.endConsultEnabled,
    callVariablesSuppressed: tenantData.callVariablesSuppressed,
    agentDbId: userData.dbId,
    allowConsultToQueue: agentProfileData.consultToQueue,
    agentPersonalStatsEnabled: agentProfileData.viewableStatistics
      ? agentProfileData.viewableStatistics.agentStats
      : false,
    addressBookId: agentProfileData.addressBookId,
    outdialANIId: agentProfileData.outdialANIId,
    analyserUserId: userData.id,

    urlMappings: {
      acqueonApiUrl: getUrlMapping(urlMapping, 'ACQUEON_API_URL'),
      acqueonConsoleUrl: getUrlMapping(urlMapping, 'ACQUEON_CONSOLE_URL'),
    },
    isTimeoutDesktopInactivityEnabled: tenantData.timeoutDesktopInactivityEnabled,
    timeoutDesktopInactivityMins: inactivityTimeoutTimer,
    loginVoiceOptions: agentProfileData.loginVoiceOptions ?? [],
    webRtcEnabled: orgSettingsData.webRtcEnabled,
    maskSensitiveData: orgSettingsData.maskSensitiveData
      ? orgSettingsData.maskSensitiveData
      : false,
    microsoftConfig: getMsftConfig(agentProfileData),
    webexConfig: getWebexConfig(agentProfileData),
    lostConnectionRecoveryTimeout:
      tenantData.lostConnectionRecoveryTimeout || LOST_CONNECTION_RECOVERY_TIMEOUT,
  };

  return finalData;
}

export {parseAgentConfigs};
