import AmpCollection from 'ampersand-collection';
import lodashMixin from 'ampersand-collection-lodash-mixin';

import CallMembership from './call-membership';

/**
 * @class
 * @name CallMemberships
 */
const CallMemberships = AmpCollection.extend(lodashMixin, {
  model: CallMembership,

  // Long-term, this should be membership id, but we don't have that yet.
  mainIndex: '_id'
});

export default CallMemberships;
