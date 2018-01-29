/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @typedef {Object} PhoneConfig
 * @property {number} [audioBandwidthLimit=64000]
 * @property {number} [videoBandwidthLimit=1000000]
 * @property {boolean} [enableExperimentalGroupCallingSupport=false] - Group
 * calling support should work, but necessarily introduces some breaking changes
 * to the API. In order to get feedback, we're keeping the API unchanged by
 * default and requiring folks to opt-in to these breakages. As these changes
 * evolve, you may see some breaking changes that don't necessarily follow
 * semantic versioning. When we're ready to drop the "experimental" moniker,
 * we'll release an official SemVer Major bump.
 * @example
 * {
 *   audioBandwidthLimit: 64000,
 *   videoBandwidthLimit: 1000000,
 *   enableExperimentalGroupCallingSupport: false,
 *   hangupIfLastActive: {
 *     call: true,
 *     meeting: false
 *   }
 * }
 */

/**
 * @typedef {Object} HangupBehavior
 * @memberof PhoneConfig
 * @property {boolean} [call=true] -  Indicates if a call (i.e. two-party
 * audio-video experience) should be ended automatically if the current user is
 * the last active member of the experience.
 * @property {boolean} [meeting=false] - Indicates if a meeting (i.e.
 * multi-party audio-video experience) should be ended automatically if the
 * current user is the last active member of the experience
 */

export default {
  phone: {
    audioBandwidthLimit: 64000,
    videoBandwidthLimit: 1000000,
    enableExperimentalGroupCallingSupport: false,
    hangupIfLastActive: {
      call: true,
      meeting: false
    }
  }
};
