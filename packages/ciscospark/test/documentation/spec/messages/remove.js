'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('removes a message', function() {
/* END_EXAMPLE_IGNORE */
var message1, room;
return ciscospark.rooms.create({title: 'Messages Example'})
  .then(function(r) {
    room = r;
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .then(function(m) {
    message1 = m;
    return ciscospark.messages.create({
      text: 'How are you?',
      roomId: room.id
    });
  })
  .then(function() {
    return ciscospark.messages.remove(message1);
  })
  .then(function() {
    return ciscospark.messages.list({roomId: room.id});
  })
  .then(function(messages) {
    assert.equal(messages.items.length, 1);
    assert(messages.items[0].id !== message1.id);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
