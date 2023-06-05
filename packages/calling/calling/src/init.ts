import Webex from '../../../webex';

export const initializeWebex = (token: string) => {
  const webex = Webex.init({
    credentials: {
      access_token: token
    },
  });

  webex.once('ready', () => {
    console.log('Webex Ready');

    webex.internal.device
    .register()
    .then(() => {
      console.log('Authentication#webex.internal.device.register successful');

      return webex.internal.mercury
        .connect()
        .then(() => {
          console.log('Authentication#webex.internal.mercury.connect successful');
        })
        .catch((error: any) => {
          console.log('Error occurred during mercury.connect()', error);
        });
    })
    .catch((error: any) => {
      console.log('Error occurred during device.register()', error);
    });
  });

  return webex;
}
