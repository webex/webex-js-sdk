import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`removes a room`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  let room = await ciscospark.rooms.create({title: `Rooms Example`});
  await ciscospark.rooms.remove(room.id);
  try {
    room = await ciscospark.rooms.get(room.id);
    assert(false, `the previous line should have failed`);
  }
  catch(reason) {
    assert.equal(reason.statusCode, 404);
  }
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
