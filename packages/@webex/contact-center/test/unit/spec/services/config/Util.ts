import {parseAgentConfigs} from '../../../../../src/services/config/Util';
import {AuxCode, DesktopProfileResponse} from '../../../../../src/services/config/types';

const baseAgentProfile: DesktopProfileResponse = {
  timeoutDesktopInactivityCustomEnabled: false,
  timeoutDesktopInactivityMins: 10,
  accessWrapUpCode: 'ALL',
  wrapUpCodes: [],
  accessIdleCode: 'ALL',
  idleCodes: [],
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
  dialPlans: [],
  agentDNValidation: 'PROVISIONED_VALUE',
  accessQueue: 'SPECIFIC',
  accessEntryPoint: 'NONE',
  accessBuddyTeam: 'ALL',
} as DesktopProfileResponse;

const baseProfileData = {
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
    teamIds: ['team-1'],
  },
  teamData: [{id: 'team-1', name: 'Support'}],
  tenantData: {
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
  },
  orgInfoData: {
    tenantId: 'tenant-1',
    timezone: 'UTC',
    environment: 'produs1',
  },
  auxCodes: [] as AuxCode[],
  orgSettingsData: {
    campaignManagerEnabled: false,
    webRtcEnabled: true,
    maskSensitiveData: false,
  },
  agentProfileData: baseAgentProfile,
  dialPlanData: [],
  urlMapping: [],
  multimediaProfileId: 'mm-1',
  aiFeatureFlags: {data: []},
};

describe('parseAgentConfigs collaboration access fields', () => {
  it('maps Desktop Profile collaboration access flags onto Profile', () => {
    const profile = parseAgentConfigs(baseProfileData);

    expect(profile.allowConsultToQueue).toBe(false);
    expect(profile.accessQueue).toBe('SPECIFIC');
    expect(profile.accessEntryPoint).toBe('NONE');
    expect(profile.accessBuddyTeam).toBe('ALL');
  });
});
