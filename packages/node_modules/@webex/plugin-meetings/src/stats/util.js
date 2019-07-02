import {forEach} from 'lodash';

import {
  STATS
} from '../constants';
import ParameterError from '../common/errors/parameter';

const StatsUtil = {};

StatsUtil.generateSingularOptions = (senderReceiver, config, meeting, name) => {
  const options = {};

  options[name] = {};
  options[name][senderReceiver.correlate] = senderReceiver;
  StatsUtil.generateOptions(options, config, meeting);
};

StatsUtil.generateOptions = (options, config, meeting) => {
  if (!options || !config || !meeting) {
    throw new ParameterError('stats/util->validateInitialization#options, config, and meeting must be provided to execute getStats');
  }
  StatsUtil.configOptions(meeting, config, options, STATS.SENDERS);
  StatsUtil.configOptions(meeting, config, options, STATS.RECEIVERS);
};

StatsUtil.configOptions = (meeting, config, options, name) => {
  if (options[name]) {
    forEach(options[name], (type) => {
      if (!type.correlate) {
        throw new ParameterError(`stats/util->validateInitialization#each ${type} must be provided with a correlate as audio OR video OR share.`);
      }
      if (!config[name][type.correlate]) {
        return;
      }
      const typeConfig = config[name][type.correlate];
      const media = meeting[typeConfig.parent][typeConfig.peerConnection];
      const filter = media[typeConfig.transceiver][typeConfig.child];

      Object.assign(type, {media, filter, name: typeConfig.name});
    });
  }
};

export default StatsUtil;
