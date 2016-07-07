import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`updates a room`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  let room = await ciscospark.rooms.create({title: `Rooms Example`});
  room.title = `Rooms Example (Updated Title)`;
  await ciscospark.rooms.update(room);
  room = await ciscospark.rooms.get(room.id);
  assert.equal(room.title, `Rooms Example (Updated Title)`);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
