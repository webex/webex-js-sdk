import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`updates a membership`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `Memberships Example`});
  const memberships = await ciscospark.memberships.list({roomId: room.id});
  let membership = memberships.items[0];
  assert.equal(membership.isModerator, false);
  membership.isModerator = true;
  await ciscospark.memberships.update(membership);
  membership = await ciscospark.memberships.get(membership.id);
  assert.equal(membership.isModerator, true);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
