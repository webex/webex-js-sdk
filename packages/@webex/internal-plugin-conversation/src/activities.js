import {sortBy} from 'lodash';

export const OLDER = 'older';
export const NEWER = 'newer';
export const MID = 'mid';
export const INITIAL = 'initial';

export const ACTIVITY_TYPES = {
  REPLY: 'REPLY',
  EDIT: 'EDIT',
  REACTION: 'REACTION',
  REACTION_SELF: 'REACTION_SELF',
  ROOT: 'ROOT',
  CREATE: 'CREATE',
  TOMBSTONE: 'TOMBSTONE',
  DELETE: 'DELETE',
  REPLY_EDIT: 'REPLY_EDIT',
};

const REPLY = 'reply';
const EDIT = 'edit';
const REACTION_SUMMARY = 'reactionSummary';
const REACTION_SELF_SUMMARY = 'reactionSelfSummary';
const CREATE = 'create';
const TOMBSTONE = 'tombstone';
const DELETE = 'delete';
const ADD = 'add';

export const getActivityType = (activity) => {
  if (activity.parent?.type === REPLY) {
    return ACTIVITY_TYPES.REPLY;
  }
  if (activity.parent?.type === EDIT) {
    return ACTIVITY_TYPES.EDIT;
  }
  if (activity.verb === ADD || activity.type === REACTION_SUMMARY) {
    return ACTIVITY_TYPES.REACTION;
  }
  if (activity.type === REACTION_SELF_SUMMARY) {
    return ACTIVITY_TYPES.REACTION_SELF;
  }
  if (activity.verb === CREATE) {
    return ACTIVITY_TYPES.CREATE;
  }
  if (activity.verb === TOMBSTONE) {
    return ACTIVITY_TYPES.TOMBSTONE;
  }
  if (activity.verb === DELETE) {
    return ACTIVITY_TYPES.DELETE;
  }

  return ACTIVITY_TYPES.ROOT;
};

export const getPublishedDate = (activity = {}) => new Date(activity.published).getTime();

/**
 * @param {Object} activity1
 * @param {Object} activity2
 * @returns {boolean} true if first activity is newer than second
 */
export const isNewer = (activity1, activity2) =>
  getPublishedDate(activity1) > getPublishedDate(activity2);

export const sortActivitiesByPublishedDate = (activities) =>
  sortBy(activities, (activity) => getPublishedDate(activity));

export const getParentId = (activity) => activity?.parent?.id;

export const isRootActivity = (act) => getActivityType(act) === ACTIVITY_TYPES.ROOT;
export const isReplyActivity = (act) => getActivityType(act) === ACTIVITY_TYPES.REPLY;
export const isEditActivity = (act) => getActivityType(act) === ACTIVITY_TYPES.EDIT;
export const isCreateActivity = (act) => getActivityType(act) === ACTIVITY_TYPES.CREATE;
export const isDeleteActivity = (act) => getActivityType(act) === ACTIVITY_TYPES.DELETE;

export const sanitizeActivity = (activity) => {
  const final = {...activity};

  final.reaction = activity.reaction || {};
  final.reactionSelf = activity.reactionSelf || {};

  // replies will be spread in order beneath parent, no need to include on final objects
  delete final.replies;

  return final;
};

export const getIsActivityOrphaned = (activity, activities) =>
  activity.parent && activity.parent.id && !activities[activity.parent.id];

const getIsReplyEditActivity = (activity, activities) => {
  const parentId = activity.parent.id;
  const parentActivity = activities[parentId];

  return parentActivity && isReplyActivity(parentActivity);
};

export const determineActivityType = (activity, activities) => {
  const initialType = getActivityType(activity);

  // edits to a reply, while they are replies themselves, appear in every way as edits
  // the only way to dermine their status as an edited reply is to find the original reply
  if (initialType === ACTIVITY_TYPES.EDIT) {
    const isReplyEditActivity = getIsReplyEditActivity(activity, activities);

    return isReplyEditActivity ? ACTIVITY_TYPES.REPLY_EDIT : initialType;
  }

  return initialType;
};

export const createRootActivity = (activity) => activity;

export const createReplyActivity = (activity) => {
  const replyAct = {
    ...activity,
    replyParent: activity.parent,
  };

  return replyAct;
};

export const createEditActivity = (editActivity, activities) => {
  const editActParentObj = editActivity.parent;
  const parentId = editActParentObj.id;
  const parentAct = activities[parentId];

  const joinedEditAct = {
    ...parentAct,
    id: editActivity.id,
    parent: editActParentObj,
    editParent: editActParentObj,
    object: editActivity.object,
    published: editActivity.published,
  };

  return joinedEditAct;
};

// takes an edit activity whose parent is a reply activity
export const createReplyEditActivity = (editActivity, activities) => {
  const editActParentObj = editActivity.parent;
  const parentId = editActParentObj.id;
  const parentReplyAct = activities[parentId];

  const joinedReplyEditActivity = {
    ...parentReplyAct,
    id: editActivity.id,
    parent: editActParentObj,
    editParent: editActParentObj,
    replyParent: parentReplyAct.parent,
    object: editActivity.object,
    published: editActivity.published,
  };

  return joinedReplyEditActivity;
};
