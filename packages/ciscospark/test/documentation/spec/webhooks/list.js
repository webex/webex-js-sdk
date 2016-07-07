'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('lists webhooks', function() {
/* END_EXAMPLE_IGNORE */
var room, webhook;
return ciscospark.rooms.create({title: 'Webhook Example'})
  .then(function(r) {
    room = r;
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
    return ciscospark.webhooks.list();
  })
  .then(function(webhooks) {
    assert.equal(webhooks.items.filter(function(w) {
      return w.id === webhook.id;
    }).length, 1);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
