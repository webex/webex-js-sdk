'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('gets a webhook', function() {
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
    return ciscospark.webhooks.get(webhook.id);
  })
  .then(function(webhook2) {
    assert.deepEqual(webhook2, webhook);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
