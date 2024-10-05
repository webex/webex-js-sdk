/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {MEETINGS} from '../constants';

const SILanguage = WebexPlugin.extend({
  idAttribute: 'languageName',

  namespace: MEETINGS,
  props: {
    languageCode: 'number',
    languageName: 'string',
  },
});

export default SILanguage;
