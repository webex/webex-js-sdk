export type Invitee = {
  memberId: string;
  emailAddress: string;
  email: string;
  phoneNumber: string;
  roles: Array<string>;
  skipEmailValidation?: boolean;
  isInternalNumber?: boolean;
};
