/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';

import {MEETINGS} from '../constants';

import SILanguage from './siLanguage';

/**
 * @class SILanguageCollection
 * @extends {AmpCollection}
 * @description A collection of SILanguage models, representing the available languages for simultaneous interpretation.
 */
class SILanguageCollection extends AmpCollection<SILanguage> {
  /**
   * The model type for this collection.
   * @type {SILanguage}
   */
  model = SILanguage;

  /**
   * The namespace for this collection.
   * @type {string}
   */
  namespace = MEETINGS;

  /**
   * The main index for this collection.
   * @type {string}
   */
  mainIndex = 'languageName';

  /**
   * The parent object of this collection.
   * @type {any}
   */
  parent: any;

  reset(siLanguages: any[]) {
    this.reset(siLanguages);
  }
}

export default SILanguageCollection;
