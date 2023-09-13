export enum ServerRoles {
  Cohost = 'COHOST',
  Moderator = 'MODERATOR',
  Presenter = 'PRESENTER',
}

export type ServerRoleShape = {
  type: ServerRoles;
  hasRole: boolean;
};

export type RoleAssignmentOptions = {
  roles: Array<ServerRoleShape>;
  locusUrl: string;
  memberId: string;
};

export type RoleAssignmentBody = {
  role: {
    roles: Array<ServerRoleShape>;
  };
};

export type RoleAssignmentRequest = {
  method: string;
  uri: string;
  body: RoleAssignmentBody;
};
