'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('retrieves a message', function() {
/* END_EXAMPLE_IGNORE */
var message;
return ciscospark.rooms.create({title: 'Messages Example'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(m) {
    message = m;
    return ciscospark.messages.get(message.id);
  })
  .then(function(message2) {
    assert.deepEqual(message2, message);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
