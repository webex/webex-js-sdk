import {encode, decode} from './base64';
import {SDK_EVENT, hydraTypes, INTERNAL_US_CLUSTER_NAME, INTERNAL_US_INTEGRATION_CLUSTER_NAME} from './constants';

const hydraBaseUrl = 'https://api.ciscospark.com/v1';

const isRequired = () => {
  throw Error('parameter is required');
};

/**
 * Constructs a Hydra ID for a given UUID and type.
 *
 * @export
 * @param {string} type one of PEOPLE, TEAM, ROOM
 * @param {any} id identifying the "TYPE" object
 * @param {string} cluster containing the "TYPE" object
 * @returns {string}
 */
export function constructHydraId(
  type = isRequired(),
  id = isRequired(),
  cluster = 'us'
) {
  if (!type.toUpperCase) {
    throw Error('"type" must be a string');
  }

  if ((type === hydraTypes.PEOPLE) || (type === hydraTypes.ORGANIZATION)) {
    // Cluster is always "us" for people and orgs
    return encode(`ciscospark://us/${type.toUpperCase()}/${id}`);
  }

  return encode(`ciscospark://${cluster}/${type.toUpperCase()}/${id}`);
}

/**
 * @typedef {Object} DeconstructedHydraId
 * @property {UUID} id identifying the object
 * @property {String} type of the object
 * @property {String} cluster containing the object
 */

/**
 * Deconstructs a Hydra ID.
 *
 * @export
 * @param {String} id Hydra style id
 * @returns {DeconstructedHydraId} deconstructed id
 */
export function deconstructHydraId(id) {
  const payload = decode(id).split('/');

  return {
    id: payload.pop(),
    type: payload.pop(),
    cluster: payload.pop()
  };
}

/**
 * Constructs a Hydra ID for a message based on internal UUID
 *
 * @export
 * @param {any} uuid
 * @param {string} cluster containing the message
 * @returns {string}
 */
export function buildHydraMessageId(uuid, cluster) {
  return constructHydraId(hydraTypes.MESSAGE, uuid, cluster);
}

/**
 * Constructs a Hydra ID for a person based on internal UUID
 *
 * @export
 * @param {any} uuid
 * @param {string} cluster containing the person
 * @returns {string}
 */
export function buildHydraPersonId(uuid, cluster) {
  return constructHydraId(hydraTypes.PEOPLE, uuid, cluster);
}

/**
 * Constructs a Hydra ID for a room based on internal UUID
 *
 * @export
 * @param {any} uuid
 * @param {string} cluster containing the room
 * @returns {string}
 */
export function buildHydraRoomId(uuid, cluster) {
  return constructHydraId(hydraTypes.ROOM, uuid, cluster);
}

/**
 * Constructs a Hydra ID for an organization based on internal UUID
 *
 * @export
 * @param {any} uuid
 * @param {string} cluster containing the organization
 * @returns {string}
 */
export function buildHydraOrgId(uuid, cluster) {
  return constructHydraId(hydraTypes.ORGANIZATION, uuid, cluster);
}

/**
 * Constructs a Hydra ID for an membership based on an
 * internal UUID for the person, and the space
 *
 * @export
 * @param {any} personUUID
 * @param {any} spaceUUID
 * @param {string} cluster containing the membership
 * @returns {string}
 */
export function buildHydraMembershipId(personUUID, spaceUUID, cluster) {
  return constructHydraId(hydraTypes.MEMBERSHIP,
    `${personUUID}:${spaceUUID}`, cluster);
}

/**
 * Returns a hydra cluster string based on a conversation url
 * @private
 * @memberof Messages
 * @param {Object} webex sdk instance
 * @param {String} conversationUrl url of space where activity took place
 * @returns {String} string suitable for UUID -> public ID encoding
 */
export function getHydraClusterString(webex, conversationUrl) {
  const internalClusterString =
    webex.internal.services.getClusterId(conversationUrl);

  if ((internalClusterString.startsWith(INTERNAL_US_CLUSTER_NAME)) ||
    (internalClusterString.startsWith(INTERNAL_US_INTEGRATION_CLUSTER_NAME))) {
    // Original US cluster is simply 'us' for backwards compatibility
    return 'us';
  }
  const clusterParts = internalClusterString.split(':');

  if (clusterParts.length < 3) {
    throw Error(`Unable to determine cluster for convo: ${conversationUrl}`);
  }

  return `${clusterParts[0]}:${clusterParts[1]}:${clusterParts[2]}`;
}

/**
 * Returns a Hydra roomType based on conversation tags
 *
 * @export
 * @param {arra} tags
 * @param {any} spaceUUID
 * @returns {string}
 */
export function getHydraRoomType(tags) {
  if (tags.includes(SDK_EVENT.INTERNAL.ACTIVITY_TAG.ONE_ON_ONE)) {
    return SDK_EVENT.EXTERNAL.SPACE_TYPE.DIRECT;
  }

  return SDK_EVENT.EXTERNAL.SPACE_TYPE.GROUP;
}

/**
 * Returns file URLs for the activity, adhering to Hydra details,
 * e.g., https://api.ciscospark.com/v1/contents/Y2lzY29zcGF...
 * @see https://developer.webex.com/docs/api/v1/messages/get-message-details
 * @param {Object} activity from mercury
 * @param {string} cluster containing the files
 * @returns {Array} file URLs
 */
export function getHydraFiles(activity, cluster) {
  const hydraFiles = [];
  const {files} = activity.object;

  if (files) {
    const {items} = files;

    // Note: Generated ID is dependent on file order.
    for (let i = 0; i < items.length; i += 1) {
      const contentId =
        constructHydraId(hydraTypes.CONTENT, `${activity.id}/${i}`, cluster);

      hydraFiles.push(`${hydraBaseUrl}/contents/${contentId}`);
    }
  }

  return hydraFiles;
}
