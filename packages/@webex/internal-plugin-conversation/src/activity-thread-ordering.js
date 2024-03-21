import {last} from 'lodash';

import {
  ACTIVITY_TYPES,
  getParentId,
  isNewer,
  getActivityType,
  sortActivitiesByPublishedDate,
  NEWER,
  OLDER,
  INITIAL,
  MID,
} from './activities';

export const defaultMinDisplayableActivities = 20;
export const minBatchSize = 10;
export const fetchLoopCountMax = 100;
export const batchSizeIncrementCount = 10;

// use accessors for ease of refactoring underlying implementation
/**
 * @param {Map} destination destination map object for data. Currently a Map, but could be refactored to use any type.
 * @param {string} key
 * @param {any} value
 * @returns {Map}
 */
export const setValue = (destination, key, value) => destination.set(key, value);
/**
 * @param {Map} source source map object to access. Currently expects a Map, but could be refactored to use any type
 * @param {string} key
 * @returns {Map}
 */
export const getValue = (source, key) => source.get(key);

export const getActivityObjectsFromMap = (hashMap) =>
  Array.from(hashMap).map(([, activity]) => activity);
/**
 * creates maps for various activity types and defines handlers for working with stored activities
 * utilizes revealing module pattern to close over state and only expose certain necessary functions for altering state
 * @function
 * @returns {object}
 * getActivityHandlerByKey(activityType) - accepts a key to map to a defined activity handler
 * getActivityByTypeAndParentId(activityType, parentId) accepts a key and a parent ID to return an activity of that type whose parent is the parentId
 */
export const activityManager = () => {
  const replyActivityHash = new Map();
  const editActivityHash = new Map();
  const reactionActivityHash = new Map();
  const reactionSelfActivityHash = new Map();

  const handleNewReply = (replyAct) => {
    const replyParentId = getParentId(replyAct);
    const existingReplyHash = getValue(replyActivityHash, replyParentId);

    if (existingReplyHash) {
      setValue(existingReplyHash, replyAct.id, replyAct);
    } else {
      const replyHash = new Map();

      setValue(replyHash, replyAct.id, replyAct);
      setValue(replyActivityHash, replyParentId, replyHash);
    }
  };

  const handleNewEdit = (editAct) => {
    const isTombstone = editAct.verb === ACTIVITY_TYPES.TOMBSTONE;

    // we can ignore tombstone edits in favor of the newer one
    if (isTombstone) {
      return;
    }

    const editParentId = getParentId(editAct);
    const existingEdit = getValue(editActivityHash, editParentId);

    // edited activity must be newer than what we already have
    if (!existingEdit || isNewer(editAct, existingEdit)) {
      setValue(editActivityHash, editParentId, editAct);
    }
  };

  // logic is identical between reactions and reaction selfs, so handler simply passes the activity and the correct hash
  const reactionHelper = (reactionAct, hash) => {
    const reactionParentId = getParentId(reactionAct);
    const existingReaction = getValue(hash, reactionParentId);

    // reaction activity must be newer than what we already have
    if (!existingReaction || isNewer(reactionAct, existingReaction)) {
      setValue(hash, reactionParentId, reactionAct);
    }
  };

  const handleNewReaction = (reactionAct) => {
    reactionHelper(reactionAct, reactionActivityHash);
  };

  const handleNewReactionSelf = (reactionSelfAct) => {
    reactionHelper(reactionSelfAct, reactionSelfActivityHash);
  };

  const getActivityHandlerByKey = (key) =>
    ({
      [ACTIVITY_TYPES.REACTION]: handleNewReaction,
      [ACTIVITY_TYPES.REACTION_SELF]: handleNewReactionSelf,
      [ACTIVITY_TYPES.EDIT]: handleNewEdit,
      [ACTIVITY_TYPES.REPLY]: handleNewReply,
    }[key]);

  const getActivityByTypeAndParentId = (type, id) =>
    ({
      [ACTIVITY_TYPES.EDIT]: getValue(editActivityHash, id),
      [ACTIVITY_TYPES.REPLY]: getValue(replyActivityHash, id),
      [ACTIVITY_TYPES.REACTION]: getValue(reactionActivityHash, id),
      [ACTIVITY_TYPES.REACTION_SELF]: getValue(reactionSelfActivityHash, id),
    }[type]);

  return {
    getActivityHandlerByKey,
    getActivityByTypeAndParentId,
  };
};

/**
 * encapsulates state and logic for managing oldest and newest activities
 * @returns {object} setters and getters for activity state management
 */
export const bookendManager = () => {
  // keep track of generator state, like what our current oldest & newest activities are
  let oldestAct;
  let newestAct;

  const getOldestAct = () => oldestAct;
  const getNewestAct = () => newestAct;

  const setOldestAct = (act) => {
    if (!oldestAct) {
      oldestAct = act;
    } else if (isNewer(oldestAct, act)) {
      oldestAct = act;
    }
  };

  const setNewestAct = (act) => {
    if (!newestAct) {
      newestAct = act;
    } else if (isNewer(act, newestAct)) {
      newestAct = act;
    }
  };

  const setBookends = (activities) => {
    const oldestActsFirst = sortActivitiesByPublishedDate(activities);

    const newestInBatch = last(oldestActsFirst);
    const oldestInBatch = oldestActsFirst[0];

    setOldestAct(oldestInBatch);
    setNewestAct(newestInBatch);
  };

  return {
    setBookends,
    getNewestAct,
    getOldestAct,
  };
};

/**
 * encapsulates state and logic for when there are no more fetchable activities from convo
 * @returns {object} setters and getters for no more activities logic
 */
export const noMoreActivitiesManager = () => {
  // used to determine if we should continue to fetch older activities
  // must be set per iteration, as querying newer activities is still valid when all end of convo has been reached
  let noMoreActs = false;
  let noOlderActs = false;
  let noNewerActs = false;

  const getNoMoreActs = () => noMoreActs;

  const checkAndSetNoOlderActs = (act) => {
    if (!noOlderActs && getActivityType(act) === ACTIVITY_TYPES.CREATE) {
      noOlderActs = true;
    }
  };

  const checkAndSetNoNewerActs = (activities) => {
    if (!activities || !activities.length) {
      noNewerActs = true;
    }
  };

  const checkAndSetNoMoreActs = (queryType, visibleActs, currentBatchSize) => {
    if (
      (queryType === NEWER && noNewerActs) ||
      ((queryType === OLDER || queryType === INITIAL) && noOlderActs) ||
      (queryType === MID && visibleActs < currentBatchSize && noOlderActs)
    ) {
      noMoreActs = true;
    }
  };

  return {
    getNoMoreActs,
    checkAndSetNoMoreActs,
    checkAndSetNoNewerActs,
    checkAndSetNoOlderActs,
  };
};

/**
 * encapsulates state and logic for managing root activities
 * @returns {object} setters and getters for activity state management
 */
export const rootActivityManager = () => {
  const rootActivityHash = new Map();

  const addNewRoot = (rootAct) => {
    setValue(rootActivityHash, rootAct.id, rootAct);
  };

  const getRootActivityHash = () => rootActivityHash;

  return {
    addNewRoot,
    getRootActivityHash,
  };
};

export const getLoopCounterFailsafe = () => {
  let fetchLoopCount = 0;

  return () => {
    fetchLoopCount += 1;
    if (fetchLoopCount > fetchLoopCountMax) {
      throw new Error('max fetches reached');
    }
  };
};

/**
 * creates activity query object
 * @param {string} type type of query to create
 * @param {object} queryOptions options to define query
 * @param {string} [queryOptions.newestPublishedDate] the date of the newest fetched activity
 * @param {string} [queryOptions.oldestPublishedDate] the date of the oldest fetched activity
 * @param {number} [queryOptions.batchSize] the number of activities to query
 * @param {object} [queryOptions.activityToSearch] a server activity to use to build middate query
 * @returns {object}
 */
export const getQuery = (type, queryOptions) => {
  const {newestPublishedDate, oldestPublishedDate, batchSize, activityToSearch = {}} = queryOptions;

  switch (type) {
    case NEWER: {
      const sinceDate = newestPublishedDate + 1;
      const lastActivityFirst = false;

      return {sinceDate, lastActivityFirst};
    }
    case MID: {
      const searchType = getActivityType(activityToSearch);
      let midDate;

      if (searchType === ACTIVITY_TYPES.REPLY || searchType === ACTIVITY_TYPES.EDIT) {
        midDate = activityToSearch.parent.published;
      } else {
        midDate = activityToSearch.published;
      }

      return {midDate, limit: batchSize};
    }
    case OLDER: {
      const maxDate = oldestPublishedDate - 1;

      return {maxDate};
    }
    case INITIAL:
    default: {
      return {};
    }
  }
};
