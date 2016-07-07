import ciscospark from '../../../../../es6';
import {getAcessTokenFromSomewhereElse} from '../../../lib/my-auth-module';
/* START_EXAMPLE_IGNORE */
it.skip(__dirname + __filename, () => {
/* END_EXAMPLE_IGNORE */

(async function run() {
  try {
    const ciscospark2 = ciscospark.init({
      credentials: {
        access_token: getAcessTokenFromSomewhereElse()
      }
    });
    const room = await ciscospark2.rooms.create({title: `My First Room`});
    await ciscospark.messages.create({
      text: `Howdy!`,
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
