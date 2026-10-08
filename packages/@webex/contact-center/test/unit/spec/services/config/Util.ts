import {parseAgentConfigs} from '../../../../../src/services/config/Util';
import {
  AgentProfile,
  AuxCode,
  DialPlanEntity,
  OrgDesktopLoginResponse,
  TeamList,
} from '../../../../../src/services/config/types';

const baseAgentProfile: AgentProfile = {
  timeoutDesktopInactivityCustomEnabled: false,
  timeoutDesktopInactivityMins: 10,
  accessWrapUpCode: 'ALL',
  accessIdleCode: 'ALL',
  autoWrapUp: false,
  autoWrapAfterSeconds: 30,
  lastAgentRouting: false,
  allowAutoWrapUpExtension: false,
  outdialEnabled: true,
  dialPlanEnabled: false,
  agentAvailableAfterOutdial: true,
  outdialEntryPointId: 'ep-1',
  consultToQueue: false,
  viewableStatistics: {agentStats: false},
  addressBookId: 'ab-1',
  outdialANIId: 'ani-1',
  loginVoiceOptions: [],
  agentDNValidation: 'PROVISIONED_VALUE',
  accessQueue: 'SPECIFIC',
  accessEntryPoint: 'NONE',
  accessBuddyTeam: 'ALL',
} as AgentProfile;

const baseOrgConfig: OrgDesktopLoginResponse = {
  organization: {
    tenantId: 'tenant-1',
    timezone: 'UTC',
  },
  organizationSetting: {
    campaignManagerEnabled: false,
    webRtcEnabled: true,
    maskSensitiveData: false,
  },
  tenantConfiguration: {
    timeoutDesktopInactivityEnabled: false,
    timeoutDesktopInactivityMins: 15,
    forceDefaultDn: false,
    dnDefaultRegex: '',
    dnOtherRegex: '',
    outdialEnabled: true,
    endCallEnabled: true,
    endConsultEnabled: true,
    callVariablesSuppressed: false,
    privacyShieldVisible: false,
    lostConnectionRecoveryTimeout: 120000,
  },
  urlMappings: {},
};

const baseProfileData = {
  orgConfig: baseOrgConfig,
  userData: {
    ciUserId: 'agent-1',
    firstName: 'Jane',
    lastName: 'Agent',
    email: 'jane@example.com',
    agentProfileId: 'profile-1',
    skillProfileId: 'skill-1',
    siteId: 'site-1',
    dbId: 'db-1',
    deafultDialledNumber: '+15551234567',
    id: 'user-1',
  },
  agentProfileData: baseAgentProfile,
  teamData: [{id: 'team-1', name: 'Support'}] as TeamList[],
  auxCodes: [] as AuxCode[],
  dialPlanData: [] as DialPlanEntity[],
  multimediaProfileId: 'mm-1',
};

const auxCodePool: AuxCode[] = [
  {
    id: 'idle-1',
    name: 'Meeting',
    workTypeCode: 'IDLE_CODE',
    active: true,
    defaultCode: false,
    isSystemCode: false,
    description: '',
  },
  {
    id: 'idle-2',
    name: 'Lunch',
    workTypeCode: 'IDLE_CODE',
    active: true,
    defaultCode: false,
    isSystemCode: false,
    description: '',
  },
  {
    id: 'idle-3',
    name: 'Retired',
    workTypeCode: 'IDLE_CODE',
    active: false,
    defaultCode: false,
    isSystemCode: false,
    description: '',
  },
  {
    id: 'wrap-1',
    name: 'Sale',
    workTypeCode: 'WRAP_UP_CODE',
    active: true,
    defaultCode: true,
    isSystemCode: false,
    description: '',
  },
  {
    id: 'wrap-2',
    name: 'No Sale',
    workTypeCode: 'WRAP_UP_CODE',
    active: true,
    defaultCode: false,
    isSystemCode: false,
    description: '',
  },
];

const dialPlans: DialPlanEntity[] = [
  {
    id: 'plan-1',
    name: 'US',
    regularExpression: '1[0-9]{10}',
    prefix: '1',
    strippedChars: '( )-',
    active: true,
  },
  {
    id: 'plan-2',
    name: 'Any Format',
    regularExpression: '[0-9a-zA-Z]+',
    prefix: '',
    strippedChars: '( )-',
    active: true,
  },
  {
    id: 'plan-3',
    name: 'Retired',
    regularExpression: '[0-9]+',
    prefix: '',
    strippedChars: '',
    active: false,
  },
];

describe('parseAgentConfigs', () => {
  describe('organization aggregate mapping', () => {
    it('maps every org-sourced field from the aggregate sections', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          organizationSetting: {
            campaignManagerEnabled: true,
            webRtcEnabled: true,
            maskSensitiveData: true,
          },
          tenantConfiguration: {
            ...baseOrgConfig.tenantConfiguration,
            forceDefaultDn: true,
            dnDefaultRegex: 'regexUS',
            dnOtherRegex: 'regexOther',
            privacyShieldVisible: true,
            timeoutDesktopInactivityEnabled: true,
            timeoutDesktopInactivityMins: 15,
          },
          urlMappings: {
            ACQUEON_API_URL: 'https://api.example.com',
            ACQUEON_CONSOLE_URL: 'https://console.example.com',
          },
        },
      });

      expect(profile.enterpriseId).toBe('tenant-1');
      expect(profile.tenantTimezone).toBe('UTC');
      expect(profile.isCampaignManagementEnabled).toBe(true);
      expect(profile.webRtcEnabled).toBe(true);
      expect(profile.maskSensitiveData).toBe(true);
      expect(profile.forceDefaultDn).toBe(true);
      expect(profile.regexUS).toBe('regexUS');
      expect(profile.regexOther).toBe('regexOther');
      expect(profile.privacyShieldVisible).toBe(true);
      expect(profile.isOutboundEnabledForTenant).toBe(true);
      expect(profile.isEndTaskEnabled).toBe(true);
      expect(profile.isEndConsultEnabled).toBe(true);
      expect(profile.lostConnectionRecoveryTimeout).toBe(120000);
      expect(profile.isTimeoutDesktopInactivityEnabled).toBe(true);
      expect(profile.timeoutDesktopInactivityMins).toBe(15);
      expect(profile.callVariablesSuppressed).toBe(false);
      expect(profile.urlMappings).toEqual({
        acqueonApiUrl: 'https://api.example.com',
        acqueonConsoleUrl: 'https://console.example.com',
      });
    });

    it('no longer emits environment', () => {
      expect(parseAgentConfigs(baseProfileData)).not.toHaveProperty('environment');
    });

    it('defaults the Acqueon URLs when urlMappings is empty or absent', () => {
      const emptyUrlMappings = {acqueonApiUrl: '', acqueonConsoleUrl: ''};

      expect(parseAgentConfigs(baseProfileData).urlMappings).toEqual(emptyUrlMappings);
      expect(
        parseAgentConfigs({
          ...baseProfileData,
          orgConfig: {...baseOrgConfig, urlMappings: undefined},
        }).urlMappings
      ).toEqual(emptyUrlMappings);
    });

    it('maps the MSFT and Webex configuration from org level', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          microsoftConfig: {showUserDetails: true, stateSynchronization: false},
          webexConfig: {showUserDetails: false, stateSynchronization: true},
        },
      });

      expect(profile.microsoftConfig).toEqual({
        showUserDetailsMS: true,
        stateSynchronizationMS: false,
      });
      expect(profile.webexConfig).toEqual({
        showUserDetailsWebex: false,
        stateSynchronizationWebex: true,
      });
    });

    it('defaults the MSFT and Webex configuration to false when the sections are absent', () => {
      const profile = parseAgentConfigs(baseProfileData);

      expect(profile.microsoftConfig).toEqual({
        showUserDetailsMS: false,
        stateSynchronizationMS: false,
      });
      expect(profile.webexConfig).toEqual({
        showUserDetailsWebex: false,
        stateSynchronizationWebex: false,
      });
    });

    it('maps the aiFeature section through as-is', () => {
      const aiFeature = {
        realtimeTranscripts: {enable: true},
        suggestedResponses: {enable: false},
      };

      expect(parseAgentConfigs({...baseProfileData, orgConfig: {...baseOrgConfig, aiFeature}})
        .aiFeature).toBe(aiFeature);
    });

    it('leaves aiFeature undefined when the section is absent', () => {
      expect(parseAgentConfigs(baseProfileData).aiFeature).toBeUndefined();
    });
  });

  describe('user aggregate mapping', () => {
    it('maps every user-sourced and agentProfile-sourced field', () => {
      const profile = parseAgentConfigs(baseProfileData);

      expect(profile.agentId).toBe('agent-1');
      expect(profile.agentName).toBe('Jane Agent');
      expect(profile.agentMailId).toBe('jane@example.com');
      expect(profile.agentProfileID).toBe('profile-1');
      expect(profile.defaultDn).toBe('+15551234567');
      expect(profile.siteId).toBe('site-1');
      expect(profile.analyserUserId).toBe('user-1');
      expect(profile.agentDbId).toBe('db-1');
      expect(profile.skillProfileId).toBe('skill-1');
      expect(profile.multimediaProfileId).toBe('mm-1');
      expect(profile.teams).toEqual(baseProfileData.teamData);
      expect(profile.forceDefaultDnForAgent).toBe(true);
      expect(profile.isAdhocDialingEnabled).toBe(false);
      expect(profile.idleCodesAccess).toBe('ALL');
      expect(profile.isOutboundEnabledForAgent).toBe(true);
      expect(profile.isAgentAvailableAfterOutdial).toBe(true);
      expect(profile.outDialEp).toBe('ep-1');
      expect(profile.outdialANIId).toBe('ani-1');
      expect(profile.addressBookId).toBe('ab-1');
      expect(profile.agentPersonalStatsEnabled).toBe(false);
      expect(profile.loginVoiceOptions).toEqual([]);
      expect(profile.wrapUpData.wrapUpProps).toMatchObject({
        autoWrapup: false,
        autoWrapupInterval: 30,
        lastAgentRoute: false,
        wrapUpCodeAccess: 'ALL',
        allowCancelAutoWrapup: false,
      });
    });

    it('maps collaboration access flags onto Profile', () => {
      const profile = parseAgentConfigs(baseProfileData);

      expect(profile.allowConsultToQueue).toBe(false);
      expect(profile.accessQueue).toBe('SPECIFIC');
      expect(profile.accessEntryPoint).toBe('NONE');
      expect(profile.accessBuddyTeam).toBe('ALL');
    });

    it('no longer emits autoAnswer', () => {
      expect(parseAgentConfigs(baseProfileData)).not.toHaveProperty('autoAnswer');
    });

    it('falls back to null when the agent has no skill profile', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        userData: {...baseProfileData.userData, skillProfileId: ''},
      });

      expect(profile.skillProfileId).toBeNull();
    });

    it.each([
      {
        name: 'the agent override when custom inactivity timeout is enabled',
        customEnabled: true,
        tenantEnabled: false,
        expected: 10,
      },
      {
        name: 'the tenant value when only the tenant timeout is enabled',
        customEnabled: false,
        tenantEnabled: true,
        expected: 15,
      },
      {
        name: 'null when neither is enabled',
        customEnabled: false,
        tenantEnabled: false,
        expected: null,
      },
    ])('resolves timeoutDesktopInactivityMins to $name', ({customEnabled, tenantEnabled, expected}) => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          tenantConfiguration: {
            ...baseOrgConfig.tenantConfiguration,
            timeoutDesktopInactivityEnabled: tenantEnabled,
          },
        },
        agentProfileData: {
          ...baseAgentProfile,
          timeoutDesktopInactivityCustomEnabled: customEnabled,
        },
      });

      expect(profile.timeoutDesktopInactivityMins).toBe(expected);
    });

    it('does not throw when the aggregate omits the inactivity minutes', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          tenantConfiguration: {
            ...baseOrgConfig.tenantConfiguration,
            timeoutDesktopInactivityEnabled: true,
            timeoutDesktopInactivityMins: undefined,
          },
        },
        agentProfileData: {...baseAgentProfile, timeoutDesktopInactivityMins: undefined},
      });

      expect(profile.timeoutDesktopInactivityMins).toBeUndefined();
    });
  });

  describe('auxiliary codes', () => {
    it('splits the pool by workTypeCode and appends the synthetic Available code', () => {
      const profile = parseAgentConfigs({...baseProfileData, auxCodes: auxCodePool});

      expect(profile.idleCodes).toEqual([
        {id: 'idle-1', name: 'Meeting', isSystem: false, isDefault: false},
        {id: 'idle-2', name: 'Lunch', isSystem: false, isDefault: false},
        {id: '0', name: 'Available', isSystem: false, isDefault: false},
      ]);
      expect(profile.wrapupCodes).toEqual([
        {id: 'wrap-1', name: 'Sale', isSystem: false, isDefault: true},
        {id: 'wrap-2', name: 'No Sale', isSystem: false, isDefault: false},
      ]);
      expect(profile.defaultWrapupCode).toBe('wrap-1');
      expect(profile.wrapUpData.wrapUpProps.wrapUpReasonList).toEqual(profile.wrapupCodes);
    });

    it('defaults defaultWrapupCode to an empty string when no code is default', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        auxCodes: auxCodePool.map((code) => ({...code, defaultCode: false})),
      });

      expect(profile.defaultWrapupCode).toBe('');
    });

    it.each(['accessIdleCode', 'accessWrapUpCode'] as const)(
      'returns the supplied pool unfiltered but still reports %s when access is SPECIFIC',
      (accessField) => {
        const profile = parseAgentConfigs({
          ...baseProfileData,
          auxCodes: auxCodePool,
          agentProfileData: {...baseAgentProfile, [accessField]: 'SPECIFIC'},
        });

        expect(profile.idleCodes).toHaveLength(3);
        expect(profile.wrapupCodes).toHaveLength(2);
        expect(profile.idleCodesAccess).toBe(
          accessField === 'accessIdleCode' ? 'SPECIFIC' : 'ALL'
        );
        expect(profile.wrapUpData.wrapUpProps.wrapUpCodeAccess).toBe(
          accessField === 'accessWrapUpCode' ? 'SPECIFIC' : 'ALL'
        );
      }
    );
  });

  describe('dial plan', () => {
    it('builds dialPlanEntity from every active plan when dial planning is enabled', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        dialPlanData: dialPlans,
        agentProfileData: {...baseAgentProfile, dialPlanEnabled: true},
      });

      expect(profile.dialPlan).toEqual({
        type: 'adhocDial',
        dialPlanEntity: [
          {regex: '1[0-9]{10}', prefix: '1', strippedChars: '( )-', name: 'US'},
          {regex: '[0-9a-zA-Z]+', prefix: '', strippedChars: '( )-', name: 'Any Format'},
        ],
      });
    });

    it('leaves dialPlan undefined when dial planning is disabled', () => {
      expect(parseAgentConfigs({...baseProfileData, dialPlanData: dialPlans}).dialPlan).toBeUndefined();
    });
  });

  describe('wellness break', () => {
    it('enables wellness only when organization config, reminders, and license are present', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          organizationSetting: {...baseOrgConfig.organizationSetting, aiAssistantQuantity: 1},
          aiFeature: {
            agentWellbeing: {
              enable: true,
              wellnessBreakReminders: 'ENABLED',
            },
          },
        },
      });

      expect(profile.isWellnessBreakEnabled).toBe(true);
    });

    it.each([
      {quantity: 0, enable: true, reminders: 'ENABLED'},
      {quantity: 1, enable: false, reminders: 'ENABLED'},
      {quantity: 1, enable: true, reminders: 'DISABLED'},
    ] as const)('disables wellness when an effective gate is missing', ({quantity, enable, reminders}) => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          organizationSetting: {...baseOrgConfig.organizationSetting, aiAssistantQuantity: quantity},
          aiFeature: {
            agentWellbeing: {enable, wellnessBreakReminders: reminders},
          },
        },
      });

      expect(profile.isWellnessBreakEnabled).toBe(false);
    });

    it('disables wellness when the aiFeature section is absent', () => {
      const profile = parseAgentConfigs({
        ...baseProfileData,
        orgConfig: {
          ...baseOrgConfig,
          organizationSetting: {...baseOrgConfig.organizationSetting, aiAssistantQuantity: 1},
        },
      });

      expect(profile.isWellnessBreakEnabled).toBe(false);
    });
  });
});
