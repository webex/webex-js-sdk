/* eslint-disable import/prefer-default-export */
import Meeting from '../meeting';

export const getAIEnablementApprover = (meeting: Meeting) => {
  const members = Object.values(meeting.members.membersCollection.members);

  // find the host, if the host has the capability, return the host id
  const host = members.find((member) => member.roles.moderator && member.canApproveAIEnablement);

  if (host) {
    return host.id;
  }

  // find the cohosts, if the host has the capability, return the host id
  const cohosts = members
    .filter((member) => member.roles.cohost && member.canApproveAIEnablement)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (cohosts.length > 0) {
    return cohosts[0].id;
  }

  // if no cohost has the capability, return null
  return null;
};
