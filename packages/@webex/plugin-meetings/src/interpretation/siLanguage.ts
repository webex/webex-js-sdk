/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';
import {MEETINGS} from '../constants';

class SILanguage extends WebexPlugin {
  idAttribute = 'languageName';

  namespace = MEETINGS;
  languageCode: number;
  languageName: string;
}

export default SILanguage;
