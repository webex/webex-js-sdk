/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';

import {MEETINGS} from '../constants';

import SILanguage from './siLanguage';

const SILanguageCollection = AmpCollection.extend({
  model: SILanguage,

  namespace: MEETINGS,

  mainIndex: 'languageName',
});

export default SILanguageCollection;
