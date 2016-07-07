'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('creates a webhook', function() {
/* END_EXAMPLE_IGNORE */
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
  .then(function(webhook) {
    assert(webhook.id);
    assert(webhook.resource);
    assert(webhook.event);
    assert(webhook.filter);
    assert(webhook.targetUrl);
    assert(webhook.name);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
