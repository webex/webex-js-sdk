import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`lists the messages for a room`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Messages Example`});
  const message1 = await ciscospark.messages.create({
    text: `Howdy!`,
    roomId: room.id
  });
  const message2 = await ciscospark.messages.create({
    text: `How are you?`,
    roomId: room.id
  });

  const messages = Array.from(await ciscospark.messages.list({roomId: room.id}));
  assert.equal(messages.length, 2);
  assert.equal(messages[0].id, message2.id);
  assert.equal(messages[1].id, message1.id);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
