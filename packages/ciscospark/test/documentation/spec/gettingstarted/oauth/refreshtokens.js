var assert = require('assert');
var ciscospark = require('../../../../../dist');
/* START_EXAMPLE_IGNORE */
it.skip(__dirname + __filename, function() {
/* END_EXAMPLE_IGNORE */
assert(process.env.CISCOSPARK_ACCESS_TOKEN);
assert(process.env.CISCOSPARK_REFRESH_TOKEN);
assert(process.env.CISCOSPARK_CLIENT_ID);
assert(process.env.CISCOSPARK_CLIENT_SECRET);
return ciscospark.rooms.create({title: 'My First Room'})
  .then(function(room) {
    return ciscospark.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .catch(function(reason) {
    console.error(reason);
    process.exit(1);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
