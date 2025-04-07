import WebexNode from 'webex-node';

const webex = WebexNode.init({
  credentials: {
    access_token: 'INSERT TOKEN HERE',
  },
});

const noop = () => {
  /* do nothing */
};
const logger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
  trace: noop,
  log: noop,
};

webex.logger = logger;

webex.once('ready', () => {
  if (webex.canAuthorize) {
    // eslint-disable-next-line no-console
    console.log('webex is authorized');
    webex.rooms
      .create({
        title: 'Test Space from NodeJS',
      })
      .then(function (room) {
        // eslint-disable-next-line no-console
        console.log('room object', room);
        webex.messages.create({
          text: 'Hello World!',
          roomId: room.id,
        });
      })
      // Make sure to log errors in case something goes wrong.
      .catch(function (reason) {
        console.error(reason);
        process.exit(1);
      });
  }
});
