import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`retrieves a message`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Messages Example`});
  const message = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  const message2 = await ciscospark.messages.get(message.id);
  assert.deepEqual(message2, message);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
