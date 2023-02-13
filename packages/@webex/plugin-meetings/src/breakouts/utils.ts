// eslint-disable-next-line import/prefer-default-export
export const getBroadcastRoles = (options): string[] => {
  const recipientRoles = [];
  if (!options || (!options.cohosts && !options.presenters)) {
    return recipientRoles;
  }
  if (options.cohosts) {
    recipientRoles.push('COHOST');
  }
  if (options.presenters) {
    recipientRoles.push('PRESENTER');
  }

  return recipientRoles;
};
