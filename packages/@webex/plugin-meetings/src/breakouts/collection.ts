/*!
 * Copyright (c) 2015-2023 Cisco Systems, Inc. See LICENSE file.
 */

import AmpCollection from 'ampersand-collection';

import {MEETINGS} from '../constants';

import Breakout from './breakout';

/**
 * @class BreakoutCollection
 * @extends {AmpCollection}
 * @description A collection of Breakout models.
 */
class BreakoutCollection extends AmpCollection<Breakout> {
  /**
   * The model type for this collection.
   * @type {Breakout}
   */
  model = Breakout;

  /**
   * The namespace for this collection.
   * @type {string}
   */
  namespace = MEETINGS;
}

export default BreakoutCollection;
