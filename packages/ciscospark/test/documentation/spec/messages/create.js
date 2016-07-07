'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('posts a message to room', function() {
/* END_EXAMPLE_IGNORE */
return ciscospark.rooms.create({title: 'Messages Example'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(message) {
    assert(message.id);
    assert(message.personId);
    assert(message.personEmail);
    assert(message.roomId);
    assert(message.created);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
