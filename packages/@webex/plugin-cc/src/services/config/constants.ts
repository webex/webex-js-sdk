// making query params configurable for List Teams and List Aux Codes API
export const DEFAULT_PAGE = 0;
export const DEFAULT_PAGE_SIZE = 100;
export const AGENT_STATE_AVAILABLE_ID = '0';
export const AGENT_STATE_AVAILABLE = 'Available';
export const AGENT_STATE_AVAILABLE_DESCRIPTION = 'Agent is available to receive calls';
export const DEFAULT_TEAM_ATTRIBUTES = ['name', 'id', 'dbId', 'desktopLayoutId'];
export const DEFAULT_AUXCODE_ATTRIBUTES = [
  'id',
  'isSystemCode',
  'name',
  'defaultCode',
  'workTypeCode',
  'active',
];
export const endPointMap = {
  userByCI: (orgId: string, agentId: string) =>
    `organization/${orgId}/user/by-ci-user-id/${agentId}`,
  desktopProfile: (orgId: string, desktopProfileId: string) =>
    `organization/${orgId}/agent-profile/${desktopProfileId}`,
  listTeams: (
    orgId: string,
    page: number,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ) =>
    `organization/${orgId}/v2/team?page=${page}&pageSize=${pageSize}${
      filter && filter.length > 0 ? `&filter=id=in=${filter}` : ''
    }&attributes=${attributes}`,
  listAuxCodes: (
    orgId: string,
    page: number,
    pageSize: number,
    filter: string[],
    attributes: string[]
  ) =>
    `organization/${orgId}/v2/auxiliary-code?page=${page}&pageSize=${pageSize}${
      filter && filter.length > 0 ? `&filter=id=in=${filter}` : ''
    }&attributes=${attributes}`,
  orgInfo: (orgId: string) => `organization/${orgId}`,
  orgSettings: (orgId: string) => `organization/${orgId}/v2/organization-setting?agentView=true`,
  tenantData: (orgId: string) => `organization/${orgId}/v2/tenant-configuration?agentView=true`,
  urlMapping: (orgId: string) => `organization/${orgId}/v2/org-url-mapping?sort=name,ASC`,
  dialPlan: (orgId: string) => `organization/${orgId}/dial-plan?agentView=true`,
};
