import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`removes a message`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Messages Example`});
  const message = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  await ciscospark.messages.create({
    text: `How are you?`,
    roomId: room.id
  });
  await ciscospark.messages.remove(message);
  const messages = await ciscospark.messages.list({roomId: room.id});
  assert.equal(messages.length, 1);
  assert(messages.items[0].id !== message.id);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
