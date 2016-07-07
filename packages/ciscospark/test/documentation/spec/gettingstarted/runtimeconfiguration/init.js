var ciscospark = require('../../../../../dist');
var getAcessTokenFromSomewhereElse = require('../../../lib/my-auth-module').getAcessTokenFromSomewhereElse;
/* START_EXAMPLE_IGNORE */
it.skip(__dirname + __filename, function() {
/* END_EXAMPLE_IGNORE */
var ciscospark2 = ciscospark.init({
  credentials: {
    /* eslint camelcase: [0] */
    access_token: getAcessTokenFromSomewhereElse()
  }
});

return ciscospark2.rooms.create({title: 'My First Room'})
  .then(function(room) {
    return ciscospark2.messages.create({
      text: 'Howdy!',
      roomId: room.id
    });
  })
  .catch(function(reason) {
    console.error(reason.stack);
    process.exit(1);
  });
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
