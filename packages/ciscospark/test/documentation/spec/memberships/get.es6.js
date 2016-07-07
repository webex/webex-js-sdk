import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`gets a membership`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
 const room = await ciscospark.rooms.create({title: `Memberships Example`});
 const membership = await ciscospark.memberships.create({
   personEmail: `alice@example.com`,
   roomId: room.id
 });
 const membership2 = await ciscospark.memberships.get(membership.id);
 assert.deepEqual(membership2, membership);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
