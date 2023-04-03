export interface IExternalRoles {
  cohost: boolean;
  moderator: boolean;
  presenter: boolean;
}

export enum ServerRoles {
  Cohost = 'COHOST',
  Moderator = 'MODERATOR',
  Presenter = 'PRESENTER',
}

export type ServerRoleShape = {
  type: ServerRoles;
  hasRole: boolean;
};

export type ParticipantWithRoles = {
  controls: {
    role: {
      roles: Array<ServerRoleShape>;
    };
  };
};
