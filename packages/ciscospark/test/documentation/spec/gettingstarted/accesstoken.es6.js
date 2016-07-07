import assert from 'assert';
import ciscospark from '../../../../es6';
/* START_EXAMPLE_IGNORE */
it.skip(__dirname + __filename, () => {
/* END_EXAMPLE_IGNORE */
assert(process.env.CISCOSPARK_ACCESS_TOKEN);
(async function() {
 try {
   let room = await ciscospark.rooms.create({title: 'My First Room'});
   let message = await ciscospark.messages.create({
     text: 'Howdy!',
     roomId: room.id
   });
 }
 catch(error) {
   console.error(error.stack);
   process.exit(1);
 }
}());
/* START_EXAMPLE_IGNORE */
});
/* END_EXAMPLE_IGNORE */
