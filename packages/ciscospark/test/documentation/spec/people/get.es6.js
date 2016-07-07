import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`gets a person`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `People Example`});
  const membership = await ciscospark.memberships.create({
    personEmail: `alice@example.com`,
    roomId: room.id
  });
  const alice = await ciscospark.people.get(membership.personId);
  assert(alice.id);
  assert(Array.isArray(alice.emails));
  assert(alice.emails.includes(`alice@example.com`));
  assert(alice.displayName);
  assert(alice.created);
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
