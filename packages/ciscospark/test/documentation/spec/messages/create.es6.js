import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`posts a message to a room`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  let room = await ciscospark.rooms.create({title: `Messages Example`});
  let message = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  assert(message.id);
  assert(message.personId);
  assert(message.personEmail);
  assert(message.roomId);
  assert(message.created);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
