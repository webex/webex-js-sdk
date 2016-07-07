import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`removes a person from a room`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  const membership = await ciscospark.memberships.create({
    personEmail: `alice@example.com`,
    roomId: room.id
  });
  let memberships = await ciscospark.memberships.list({roomId: room.id});
  assert.equal(memberships.length, 2);
  await ciscospark.memberships.remove(membership);
  memberships = await ciscospark.memberships.list({roomId: room.id});
  assert.equal(memberships.length, 1);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
