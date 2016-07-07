import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`lists a set of rooms`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const createdRooms = await Promise.all([
    await ciscospark.rooms.create({title: `Rooms Example 1`}),
    await ciscospark.rooms.create({title: `Rooms Example 2`}),
    await ciscospark.rooms.create({title: `Rooms Example 3`})
  ]);

  const rooms = await ciscospark.rooms.list({max: 3});
  assert(rooms.length === 3);
  for (const room of rooms) {
    assert(createdRooms.find((r) => r.id === room.id));
  }
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
