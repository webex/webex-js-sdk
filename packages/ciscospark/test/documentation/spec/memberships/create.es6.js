import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`creates a membership`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  const membership = await ciscospark.memberships.create({
   personEmail: `alice@example.com`,
   roomId: room.id
  });
  assert(membership.id);
  assert(membership.roomId);
  assert(membership.personId);
  assert(membership.personEmail);
  assert(`isModerator` in membership);
  assert(`isMonitor` in membership);
  assert(membership.created);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
