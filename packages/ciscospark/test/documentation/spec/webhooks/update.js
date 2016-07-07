'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('creates a webhook', function() {
/* END_EXAMPLE_IGNORE */
var webhook;
return ciscospark.rooms.create({title: 'Webhook Example'})
  .then(function(room) {
    return ciscospark.webhooks.create({
      resource: 'messages',
      event: 'created',
      filter: 'roomId=' + room.id,
      targetUrl: 'https://example.com/webhook',
      name: 'Test Webhook'
    });
  })
  .then(function(w) {
    webhook = w;
    webhook.targetUrl = 'https://example.com/webhook/newtarget';
    return ciscospark.webhooks.update(webhook);
  })
  .then(function() {
    return ciscospark.webhooks.get(webhook);
  })
  .then(function(webhook) {
    assert.equal(webhook.targetUrl, 'https://example.com/webhook/newtarget');
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
