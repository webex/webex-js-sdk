'use strict';

var assert = require('assert');
var ciscospark = require('../../../..');
/* START_EXAMPLE_IGNORE */
it('lists the messages for a room', function() {
/* END_EXAMPLE_IGNORE */
var message1, message2, room;
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
  .then(function(m) {
    message2 = m;
    return ciscospark.messages.list({roomId: room.id});
  })
  .then(function(messages) {
    assert.equal(messages.length, 2);
    assert.equal(messages.items[0].id, message2.id);
    assert.equal(messages.items[1].id, message1.id);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
