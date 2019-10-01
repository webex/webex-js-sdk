const HostUtils = {};

/**
 * parse the relevant host values that we care about: id
 * @param {Object} host
 * @returns {Object} parsed host or null if host was undefined
 */
HostUtils.parse = (host) => {
  if (host) {
    return {
      hostId: HostUtils.getId(host)
    };
  }

  return null;
};

/**
 * get the previous and current host values parsed, as well as the boolean updates
 * @param {Object} oldHost
 * @param {Object} newHost
 * @returns {Object}
 * previous: {Object} old host, current: {Object} new host, updates: {isNewHost: {boolean}} boolean update values
 */
HostUtils.getHosts = (oldHost, newHost) => {
  const previous = oldHost && HostUtils.parse(oldHost);
  const current = newHost && HostUtils.parse(newHost);

  return {
    previous,
    current,
    updates: {
      isNewHost: previous && current ? HostUtils.isDifferentHosts(previous.hostId, current.hostId) : true
    }
  };
};

/**
 * determine by id if 2 hosts are different
 * @param {String} previousId
 * @param {String} currentId
 * @returns {Boolean}
 */
HostUtils.isDifferentHosts = (previousId, currentId) => previousId !== currentId;

/**
 * Extract the id from the host object
 * @param {Object} host
 * @returns {String}
 */
HostUtils.getId = (host) => {
  if (!host) {
    return null;
  }

  return host.id;
};

export default HostUtils;
