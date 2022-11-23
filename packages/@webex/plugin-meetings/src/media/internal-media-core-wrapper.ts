import {MediaConnection as MC} from '@webex/internal-media-core';

/* We have this wrapper just because otherwise it's impossible to mock
 * RoapMediaConnection and MultistreamRoapMediaConnection constructors in unit tests,
 * because they are exported by @webex/internal-media-core as non-writable, non-configurable
 * properties of MediaConnection and sinon doesn't allow spying on them or stubbing them.
 */
export const RoapMediaConnection = MC.RoapMediaConnection;
export const MultistreamRoapMediaConnection = MC.MultistreamRoapMediaConnection;
