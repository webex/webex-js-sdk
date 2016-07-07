import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`retrieves a room`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  let room = await ciscospark.rooms.create({title: `Rooms Example`});
  let room2 = await ciscospark.rooms.get(room.id);
  assert.equal(room2.id, room.id);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
