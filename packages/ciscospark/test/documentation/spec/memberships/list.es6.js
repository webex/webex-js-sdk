import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`lists memberships`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  await ciscospark.memberships.create({
   personEmail: `alice@example.com`,
   roomId: room.id
  });
  const memberships = await ciscospark.memberships.list({roomId: room.id});
  assert.equal(memberships.length, 2);
  for (const membership of memberships) {
    assert.equal(membership.roomId, room.id);
  }
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
