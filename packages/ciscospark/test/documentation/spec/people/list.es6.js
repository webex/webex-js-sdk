import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it(`searches for people`, () => {
/* END_EXAMPLE_IGNORE */
return (async function() {
  const room = await ciscospark.rooms.create({title: `People Example`});
  const aliceMembership = await ciscospark.memberships.create({
    personEmail: `alice@example.com`,
    roomId: room.id
  });
  const bobMembership = await ciscospark.memberships.create({
    personEmail: `bob@example.com`,
    roomId: room.id
  });

  let people = await ciscospark.people.list({email: `alice@example.com`});
  assert.equal(people.length, 1);
  for (const person of people) {
    if (person.emails.includes(`alice@example.com`)) {
      assert(person.id);
      assert(Array.isArray(person.emails));
      assert(person.displayName);
      assert(person.created);
    }
  }
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
