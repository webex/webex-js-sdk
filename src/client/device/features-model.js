/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AmpState = require('ampersand-state');
var FeatureCollection = require('./feature-collection');

var FeaturesModel = AmpState.extend({
  collections: {
    developer: FeatureCollection,
    entitlement: FeatureCollection,
    user: FeatureCollection
  },

  _emitDeveloperChange: function emitDeveloperChange() {
    this.trigger('change:developer', this.developer);
  },

  _emitEntitlementChange: function emitEntitlementChange() {
    this.trigger('change:entitlement', this.entitlement);
  },

  _emitUserChange: function emitUserChange() {
    this.trigger('change:user', this.user);
  },

  initialize: function initialize() {
    this.developer.on('change:value', this._emitDeveloperChange.bind(this));
    this.developer.on('add', this._emitDeveloperChange.bind(this));
    this.developer.on('remove', this._emitDeveloperChange.bind(this));
    this.entitlement.on('change:value', this._emitEntitlementChange.bind(this));
    this.entitlement.on('add', this._emitEntitlementChange.bind(this));
    this.entitlement.on('remove', this._emitEntitlementChange.bind(this));
    this.user.on('change:value', this._emitUserChange.bind(this));
    this.user.on('add', this._emitUserChange.bind(this));
    this.user.on('remove', this._emitUserChange.bind(this));
  }
});

module.exports = FeaturesModel;
